import {
    isPdfMagicBytes,
    parseDocxBufferToDocument,
    parsePdfBufferToDocument,
    parsePlainTextToDocument,
    validateFile,
} from '../../../lib/documentParser'

export const runtime = 'nodejs'

function errorResponse(message, code, status = 400) {
    return Response.json(
        {
            code,
            message,
        },
        { status }
    )
}

export async function POST(request) {
    try {
        const formData = await request.formData()
        const inputType = formData.get('inputType')

        if (inputType === 'text') {
            const text = formData.get('text')
            const parsedDocument = await parsePlainTextToDocument(text)
            return Response.json({ parsedDocument })
        }

        if (inputType !== 'file') {
            return errorResponse('请求参数无效，请刷新后重试。', 'INVALID_INPUT')
        }

        const file = formData.get('file')
        validateFile(file)

        const mimeType = (file.type || '').toLowerCase()
        const buffer = Buffer.from(await file.arrayBuffer())
        const nameLower = (file.name || '').toLowerCase()
        const looksPdf =
            mimeType === 'application/pdf' ||
            nameLower.endsWith('.pdf') ||
            isPdfMagicBytes(buffer)
        const looksDocx =
            mimeType ===
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            nameLower.endsWith('.docx')

        let parsedDocument
        if (looksPdf) {
            parsedDocument = await parsePdfBufferToDocument(buffer)
        } else if (looksDocx) {
            parsedDocument = await parseDocxBufferToDocument(buffer)
        } else {
            return errorResponse(
                '仅支持 PDF 或 DOCX 文件，请检查后重试。',
                'UNSUPPORTED_FILE_TYPE'
            )
        }

        return Response.json({ parsedDocument })
    } catch (error) {
        const message = error?.message || '文档解析失败，请稍后重试。'
        const status =
            message.includes('10MB') ||
            message.includes('仅支持') ||
            message.includes('请输入') ||
            message.includes('上传') ||
            message.includes('为空')
                ? 400
                : 500
        return errorResponse(message, 'DOCUMENT_PARSE_FAILED', status)
    }
}
