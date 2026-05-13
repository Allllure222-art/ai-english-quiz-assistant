import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import mammoth from 'mammoth'

import { ensurePdfJsNodeGlobals } from './ensurePdfJsNodeGlobals'

/** Next 打包后相对路径 `./pdf.worker.mjs` 会指向 `.next/server/`，需显式指向包内文件。 */
function getPdfWorkerFileUrl() {
    const workerPath = join(
        process.cwd(),
        'node_modules',
        'pdfjs-dist',
        'build',
        'pdf.worker.mjs'
    )
    if (!existsSync(workerPath)) {
        throw new Error(
            '未找到 pdf.worker.mjs。请在项目根目录执行 npm install，并确认已安装 pdfjs-dist。'
        )
    }
    return pathToFileURL(workerPath).href
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const MAX_PROMPT_TEXT_LENGTH = 12000

function normalizeLine(line) {
    return line.replace(/\s+/g, ' ').trim()
}

function buildPage(pageNumber, text) {
    let cursor = 0
    const rawLines = text.split(/\r?\n/)
    const lines = rawLines
        .map((line) => normalizeLine(line))
        .filter(Boolean)
        .map((line, index) => {
            const charStart = cursor
            const charEnd = charStart + line.length
            cursor = charEnd + 1
            return {
                lineNumber: index + 1,
                text: line,
                charStart,
                charEnd,
            }
        })

    return {
        pageNumber,
        text: lines.map((line) => line.text).join('\n'),
        lines,
    }
}

function buildParsedDocument({ sourceType, pages }) {
    const cleanedPages = pages.filter((page) => page.lines.length > 0)
    const fullText = cleanedPages.map((page) => page.text).join('\n\n').trim()

    return {
        documentId: crypto.randomUUID(),
        sourceType,
        fullText,
        promptText: fullText.slice(0, MAX_PROMPT_TEXT_LENGTH),
        pages: cleanedPages,
        searchableIndex: cleanedPages.flatMap((page) =>
            page.lines.map((line) => ({
                page: page.pageNumber,
                line: line.lineNumber,
                text: line.text.toLowerCase(),
            }))
        ),
    }
}

export function validateFile(file) {
    if (!file) {
        throw new Error('请先上传文件。')
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error('文件超过 10MB 限制，请压缩后重试。')
    }
}

/** Windows 部分浏览器对 PDF 的 `file.type` 为空，用文件头判断。 */
export function isPdfMagicBytes(buffer) {
    if (!buffer || buffer.length < 5) return false
    const head = Buffer.from(buffer).subarray(0, 5).toString('ascii')
    return head.startsWith('%PDF')
}

export async function parsePlainTextToDocument(text) {
    const normalized = typeof text === 'string' ? text.trim() : ''
    if (!normalized) {
        throw new Error('请输入或上传用于出题的英文材料。')
    }
    return buildParsedDocument({
        sourceType: 'text',
        pages: [buildPage(1, normalized)],
    })
}

export async function parseDocxBufferToDocument(buffer) {
    const result = await mammoth.extractRawText({ buffer })
    const text = result.value?.trim()
    if (!text) {
        throw new Error('DOCX 内容为空或解析失败，请检查文件内容。')
    }
    return buildParsedDocument({
        sourceType: 'docx',
        pages: [buildPage(1, text)],
    })
}

export async function parsePdfBufferToDocument(buffer) {
    // 使用标准 build，避免 legacy 包内 core-js 对 global DOMException 的补丁
    // 在 Node 22+ 上触发 “Cannot redefine property: …”（进而导致 PDF 解析失败）。
    try {
        await ensurePdfJsNodeGlobals()
        const pdfjs = await import('pdfjs-dist/build/pdf.mjs')
        pdfjs.GlobalWorkerOptions.workerSrc = getPdfWorkerFileUrl()
        const loadingTask = pdfjs.getDocument({
            data: new Uint8Array(buffer),
            useWorkerFetch: false,
            isEvalSupported: false,
            disableFontFace: true,
        })
        const pdf = await loadingTask.promise
        const pageTexts = []

        for (let i = 1; i <= pdf.numPages; i += 1) {
            const page = await pdf.getPage(i)
            const textContent = await page.getTextContent()
            const text = textContent.items
                .map((item) => item.str || '')
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim()
            pageTexts.push(text)
        }

        const pages = pageTexts.map((text, index) => buildPage(index + 1, text))
        if (!pages.length) {
            throw new Error('PDF 解析失败，请尝试转换为可复制文本的 PDF。')
        }
        return buildParsedDocument({
            sourceType: 'pdf',
            pages,
        })
    } catch (err) {
        const msg = err?.message || String(err)
        if (msg.includes('redefine')) {
            throw new Error(
                'PDF 引擎与当前 Node 环境冲突。请升级依赖或联系维护者；也可先将 PDF 全文复制为文本后粘贴出题。'
            )
        }
        throw err
    }
}
