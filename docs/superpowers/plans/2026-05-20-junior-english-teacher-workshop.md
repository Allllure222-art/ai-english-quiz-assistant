# 初中英语教师备课工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 AI 英语出题助手仓库上，新增教师主路径 `/workshop`（审阅编辑 + 导出学生/教师 Word 与 PDF），并将首页与 Reading Hub 默认导向备课台。

**Architecture:** 复用 `/api/parse-document` 与 `/api/chat` 生成题目；用 `WorkshopBundle` 作为工作台单一数据源（`sessionStorage`）；从 `app/quiz/page.jsx` 抽取出题请求与 `DocumentViewer`；新增 `lib/export/*` + `POST /api/export` 生成文件。`/quiz` 保留为在线预览副路径。

**Tech Stack:** Next.js 13 App Router, React 18, Tailwind, Zod, OpenAI API, 新依赖 `docx`、（PDF）`puppeteer-core` + `@sparticuz/chromium`

**Spec:** [`docs/superpowers/specs/2026-05-20-junior-english-teacher-workshop-design.md`](../specs/2026-05-20-junior-english-teacher-workshop-design.md)

---

## File Map（创建 / 修改）

| 文件 | 职责 |
|------|------|
| `lib/quizGenerationClient.js` | **新建** — `buildPhaseCopy`、`mapQuizFetchFailure`、`QUIZ_FETCH_TIMEOUT_MS`（从 quiz 页抽出） |
| `lib/workshopBundle.js` | **新建** — 组装 / 读写 `WorkshopBundle`、`sessionStorage` 键 |
| `lib/export/buildDocumentModel.js` | **新建** — Bundle → 中性段落结构 |
| `lib/export/formatters.js` | **新建** — 题号、选项 A–D、完形空位标记 |
| `lib/export/renderDocx.js` | **新建** — `docx` 生成 Buffer |
| `lib/export/renderHtml.js` | **新建** — 学生版打印 HTML |
| `lib/export/renderPdf.js` | **新建** — HTML → PDF（puppeteer） |
| `lib/export/validateExportBundle.js` | **新建** — zod + 体积上限 |
| `app/api/export/route.js` | **新建** — POST 导出 |
| `app/components/DocumentViewer.jsx` | **新建** — 从 quiz 页抽出原文面板 |
| `app/components/workshop/QuestionEditor.jsx` | **新建** — 单题编辑表单 |
| `app/components/workshop/WorkshopMetaForm.jsx` | **新建** — 标题/副标题 |
| `app/components/workshop/ExportToolbar.jsx` | **新建** — 导出按钮 + 含依据勾选 |
| `app/hooks/useQuizGeneration.js` | **新建** — 共享出题 effect |
| `app/workshop/page.jsx` | **新建** — 备课工作台 |
| `app/quiz/page.jsx` | **修改** — 改用共享模块；顶栏提示去工作台 |
| `app/page.jsx` | **修改** — 文案 + 跳转 `/workshop` |
| `app/reading/[id]/page.jsx` | **修改** — CTA + 跳转 `/workshop` |
| `app/reading-hub/page.jsx` | **修改** — 文案微调 |
| `app/layout.jsx` | **修改**（可选）— 默认 title |
| `package.json` | **修改** — 新依赖 |
| `README.md` | **修改** — 教师场景与导出说明 |

---

## Task 1: 依赖与 WorkshopBundle 工具库

**Files:**
- Modify: `package.json`
- Create: `lib/workshopBundle.js`
- Test: `node --test lib/workshopBundle.test.js`（新建）

- [ ] **Step 1: 安装依赖**

```bash
npm install docx puppeteer-core @sparticuz/chromium
```

- [ ] **Step 2: 创建 `lib/workshopBundle.js`**

```javascript
const STORAGE_PREFIX = 'workshop:'

export function defaultBundleMeta({ quizType, difficulty, numQuestions, title }) {
    return {
        title: title || (quizType === 'cloze' ? '完形填空练习' : '阅读理解练习'),
        subtitle: '',
        quizType,
        difficulty,
        numQuestions,
        createdAt: new Date().toISOString(),
    }
}

export function createWorkshopBundle({
    quizType,
    difficulty,
    numQuestions,
    parsedDocument,
    questions,
    title,
    articleMeta,
}) {
    const plainText = parsedDocument?.promptText || ''
    return {
        meta: defaultBundleMeta({ quizType, difficulty, numQuestions, title: title || articleMeta?.title }),
        passage: { plainText, parsedDocument },
        questions,
        exportPrefs: { includeEvidenceInTeacher: true },
        articleMeta: articleMeta || null,
    }
}

export function saveWorkshopBundle(draftId, bundle) {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(`${STORAGE_PREFIX}${draftId}`, JSON.stringify(bundle))
}

export function loadWorkshopBundle(draftId) {
    if (typeof window === 'undefined') return null
    const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${draftId}`)
    if (!raw) return null
    try {
        return JSON.parse(raw)
    } catch {
        return null
    }
}

export { STORAGE_PREFIX }
```

- [ ] **Step 3: 创建 `lib/workshopBundle.test.js`**

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createWorkshopBundle, defaultBundleMeta } from './workshopBundle.js'

test('createWorkshopBundle sets defaults', () => {
    const bundle = createWorkshopBundle({
        quizType: 'reading',
        difficulty: 'beginner',
        numQuestions: 5,
        parsedDocument: { promptText: 'Hello world', pages: [] },
        questions: [{ questionType: 'reading', query: 'Q?', choices: ['a','b','c','d'], answer: 0, explanationZh: '因为', sourceEvidence: 'Hello', sourcePosition: { page:1,lineStart:1,lineEnd:1,charStart:0,charEnd:5,quote:'Hello',precision:'exact' }, subType: 'detail' }],
    })
    assert.equal(bundle.meta.quizType, 'reading')
    assert.equal(bundle.passage.plainText, 'Hello world')
    assert.equal(bundle.exportPrefs.includeEvidenceInTeacher, true)
})
```

- [ ] **Step 4: 运行测试**

```bash
node --test lib/workshopBundle.test.js
```

Expected: `pass`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/workshopBundle.js lib/workshopBundle.test.js
git commit -m "feat: add workshop bundle helpers and export dependencies"
```

---

## Task 2: 抽出共享出题客户端逻辑

**Files:**
- Create: `lib/quizGenerationClient.js`
- Create: `app/hooks/useQuizGeneration.js`
- Modify: `app/quiz/page.jsx`（删除重复函数，改用 import）

- [ ] **Step 1: 创建 `lib/quizGenerationClient.js`**

将 `app/quiz/page.jsx` 第 12–101 行的 `QUIZ_FETCH_TIMEOUT_MS`、`buildPhaseCopy`、`mapQuizFetchFailure` **原样移动**到此文件并 `export`。

- [ ] **Step 2: 创建 `app/hooks/useQuizGeneration.js`**

封装与 quiz 页 `useEffect`（约 165–302 行）等价的逻辑：

```javascript
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { QUIZ_FETCH_TIMEOUT_MS, mapQuizFetchFailure } from '../../lib/quizGenerationClient'

export function useQuizGeneration({ quizType, difficulty, numQuestions, draftId, generationKey, onSuccess }) {
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [errorDetail, setErrorDetail] = useState(null)
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const abortRef = useRef(null)
    const abortKindRef = useRef('')

    const cancel = useCallback(() => {
        abortKindRef.current = 'user'
        abortRef.current?.abort()
    }, [])

    useEffect(() => {
        if (!draftId || !quizType) return
        // ... 复制 quiz 页 fetch /api/chat 流程 ...
        // onSuccess({ questions, parsedDocument, articleMeta })
    }, [quizType, difficulty, numQuestions, draftId, generationKey])

    return { isLoading, errorMessage, errorDetail, elapsedSeconds, cancel, abortKindRef }
}
```

`onSuccess` 回调参数：`{ questions, parsedDocument, articleMeta }`。

- [ ] **Step 3: 修改 `app/quiz/page.jsx`**

- 删除本地 `buildPhaseCopy`、`mapQuizFetchFailure`、`QUIZ_FETCH_TIMEOUT_MS`
- `import { buildPhaseCopy, mapQuizFetchFailure } from '../../lib/quizGenerationClient'`
- 可选：改用 `useQuizGeneration`（若一次性替换风险大，本任务仅抽 `lib/quizGenerationClient.js`，workshop 与 quiz 共用 import）

- [ ] **Step 4: 手动验证**

```bash
npm run dev
```

打开 `/quiz?...`（用首页走一遍旧链接），确认出题与错误提示仍正常。

- [ ] **Step 5: Commit**

```bash
git add lib/quizGenerationClient.js app/quiz/page.jsx app/hooks/useQuizGeneration.js
git commit -m "refactor: extract quiz generation client utilities"
```

---

## Task 3: 抽出 DocumentViewer 组件

**Files:**
- Create: `app/components/DocumentViewer.jsx`
- Modify: `app/quiz/page.jsx`

- [ ] **Step 1: 创建 `app/components/DocumentViewer.jsx`**

将 `app/quiz/page.jsx` 中 `DocumentViewer`、`highlightLineText`、`getRenderedLine`、`hasBadCharRange`、`hasOverlap`、`groupQuestionsByType`（559–868 行区间）移至新文件并 `export default DocumentViewer`。

Props 保持不变：

```javascript
export default function DocumentViewer({
    parsedDocument,
    activeSourcePosition,
    activeQuestionMeta,
    clozeQuestions,
    revealMode = 'per-question',
    revealedQuestionIds = [],
    isAllSubmitted = false,
    quizType,
})
```

- [ ] **Step 2: 修改 quiz 页**

`import DocumentViewer from '../components/DocumentViewer'`，删除已移动代码。

- [ ] **Step 3: 手动验证**

在 `/quiz` 生成后点击「查看原文依据」，高亮与滚动仍正常。

- [ ] **Step 4: Commit**

```bash
git add app/components/DocumentViewer.jsx app/quiz/page.jsx
git commit -m "refactor: extract DocumentViewer for reuse in workshop"
```

---

## Task 4: 导出管线 — buildDocumentModel 与 renderDocx

**Files:**
- Create: `lib/export/formatters.js`
- Create: `lib/export/buildDocumentModel.js`
- Create: `lib/export/renderDocx.js`
- Create: `lib/export/buildDocumentModel.test.js`

- [ ] **Step 1: `lib/export/formatters.js`**

```javascript
const CHOICE_LABELS = ['A', 'B', 'C', 'D']

export function formatChoiceLine(index, text) {
    return `${CHOICE_LABELS[index]}. ${text}`
}

export function formatClozePassageWithBlanks(plainText, questions) {
    // MVP: 若 plainText 已含空位则原样返回；否则在题目前附「见题目区」说明
    return plainText
}

export function evidenceFooter(question, includeEvidence) {
    if (!includeEvidence) return []
    const lines = []
    if (question.sourceEvidence) lines.push(`依据：${question.sourceEvidence}`)
    const pos = question.sourcePosition
    if (pos?.page) {
        lines.push(
            `定位：约第 ${pos.page} 页，第 ${pos.lineStart}${pos.lineEnd !== pos.lineStart ? `–${pos.lineEnd}` : ''} 行`
        )
    }
    return lines
}
```

- [ ] **Step 2: `lib/export/buildDocumentModel.js`**

输出结构：

```javascript
// { headerLines, passageParagraphs, questionBlocks[], isTeacher, includeEvidence, quizType }
export function buildDocumentModel(bundle, { variant }) {
    const isTeacher = variant === 'teacher'
    const includeEvidence = isTeacher && bundle.exportPrefs?.includeEvidenceInTeacher
    // reading: 每题 { number, query, choices, answerLine?, explanationLines?, evidenceLines? }
    // cloze: passage + 每空题目块
}
```

- [ ] **Step 3: `lib/export/renderDocx.js`**

使用 `docx`：

```javascript
import {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
} from 'docx'

export async function renderDocxBuffer(documentModel) {
    const children = []
    // 页眉：标题 + 姓名________ 班级________
    // 正文段落：passage
    // 题目：Heading2 + 选项；教师版追加「答案：B」「解析：…」
    const doc = new Document({ sections: [{ children }] })
    return Packer.toBuffer(doc)
}
```

字体：`Times New Roman` 英文；`explanationZh` / evidence 用 `宋体` 或 `SimSun`（`docx` 的 `font: 'SimSun'`）。

- [ ] **Step 4: 单元测试 `buildDocumentModel.test.js`**

断言学生版 `questionBlocks` 无 `answerLine`；教师版含 `answerLine`；`includeEvidence=false` 时无 `evidenceLines`。

```bash
node --test lib/export/buildDocumentModel.test.js
```

- [ ] **Step 5: Commit**

```bash
git add lib/export/
git commit -m "feat: add document model and docx renderer for workshop export"
```

---

## Task 5: PDF 渲染与导出校验

**Files:**
- Create: `lib/export/renderHtml.js`
- Create: `lib/export/renderPdf.js`
- Create: `lib/export/validateExportBundle.js`

- [ ] **Step 1: `lib/export/renderHtml.js`**

生成完整 HTML 字符串（内联 CSS）：A4、`font-family: 'Times New Roman', serif`、题目 `.question`、选项 `.choice`，**不含答案**。

- [ ] **Step 2: `lib/export/renderPdf.js`**

```javascript
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

export async function renderPdfBuffer(html) {
    const executablePath = await chromium.executablePath()
    const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath,
        headless: chromium.headless,
    })
    try {
        const page = await browser.newPage()
        await page.setContent(html, { waitUntil: 'networkidle0' })
        return await page.pdf({ format: 'A4', printBackground: true })
    } finally {
        await browser.close()
    }
}
```

本地 `npm run dev` 若 Chromium 下载失败：在 README 记录「PDF 仅生产/Vercel 可用，本地可只测 Word」。

- [ ] **Step 3: `lib/export/validateExportBundle.js`**

```javascript
import { z } from 'zod'
// 复用 quizSchema 的 question 形状，或 import quizSchema 内 schema
const bundleSchema = z.object({
    meta: z.object({ title: z.string().min(1).max(200), quizType: z.enum(['reading','cloze']), /* ... */ }),
    passage: z.object({ plainText: z.string() }),
    questions: z.array(z.any()).min(1).max(30),
})

const MAX_BODY_BYTES = 800_000

export function validateExportRequest(body) {
    const json = JSON.stringify(body)
    if (json.length > MAX_BODY_BYTES) return { ok: false, message: '导出内容过大，请减少材料或题量。' }
    const parsed = bundleSchema.safeParse(body.bundle)
    if (!parsed.success) return { ok: false, message: '题目数据无效，请在工作台检查后重试。' }
    return { ok: true, data: parsed.data }
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/export/renderHtml.js lib/export/renderPdf.js lib/export/validateExportBundle.js
git commit -m "feat: add HTML/PDF export and bundle validation"
```

---

## Task 6: POST /api/export

**Files:**
- Create: `app/api/export/route.js`

- [ ] **Step 1: 实现路由**

```javascript
import { buildDocumentModel } from '../../../lib/export/buildDocumentModel'
import { renderDocxBuffer } from '../../../lib/export/renderDocx'
import { renderHtmlForStudent } from '../../../lib/export/renderHtml'
import { renderPdfBuffer } from '../../../lib/export/renderPdf'
import { validateExportRequest } from '../../../lib/export/validateExportBundle'

export const runtime = 'nodejs'
// Next 14+ 可加: export const maxDuration = 60

export async function POST(request) {
    const body = await request.json()
    const validated = validateExportRequest(body)
    if (!validated.ok) {
        return Response.json({ message: validated.message, code: 'INVALID_EXPORT' }, { status: 400 })
    }
    const bundle = body.bundle
    if (body.includeEvidence != null) {
        bundle.exportPrefs = { ...bundle.exportPrefs, includeEvidenceInTeacher: Boolean(body.includeEvidence) }
    }
    const variant = body.variant
    try {
        if (variant === 'pdf') {
            const model = buildDocumentModel(bundle, { variant: 'student' })
            const html = renderHtmlForStudent(model)
            const pdf = await renderPdfBuffer(html)
            return new Response(pdf, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${encodeURIComponent(bundle.meta.title)}-学生版.pdf"`,
                },
            })
        }
        const model = buildDocumentModel(bundle, { variant: variant === 'teacher' ? 'teacher' : 'student' })
        const buf = await renderDocxBuffer(model)
        const suffix = variant === 'teacher' ? '教师版' : '学生版'
        return new Response(buf, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(bundle.meta.title)}-${suffix}.docx"`,
            },
        })
    } catch (err) {
        console.error('export failed', err)
        return Response.json(
            { message: '导出失败，请稍后重试。若仅 PDF 失败，可先导出 Word 另存为 PDF。', code: 'EXPORT_FAILED' },
            { status: 500 }
        )
    }
}
```

- [ ] **Step 2: 用 curl 测 Word（需先有最小 bundle JSON 文件 `scripts/fixtures/min-bundle.json`）**

```bash
curl -X POST http://localhost:3000/api/export \
  -H "Content-Type: application/json" \
  -d "{\"variant\":\"student\",\"bundle\":$(cat scripts/fixtures/min-bundle.json)}" \
  --output test-student.docx
```

Expected: 文件 > 1KB，Word 可打开。

- [ ] **Step 3: Commit**

```bash
git add app/api/export/route.js scripts/fixtures/min-bundle.json
git commit -m "feat: add POST /api/export for Word and PDF"
```

---

## Task 7: 工作台 UI 组件

**Files:**
- Create: `app/components/workshop/WorkshopMetaForm.jsx`
- Create: `app/components/workshop/QuestionEditor.jsx`
- Create: `app/components/workshop/ExportToolbar.jsx`

- [ ] **Step 1: `WorkshopMetaForm.jsx`**

字段：`title`、`subtitle`；`onChange` 向上传递。

- [ ] **Step 2: `QuestionEditor.jsx`**

Props：`question`, `index`, `quizType`, `onChange`, `onLocateEvidence`。

- 阅读：`query` textarea；4× `choices` input；`answer` `<select>`；`explanationZh` textarea  
- 完形：显示 `第 {blankIndex} 空` + 同上  
- 按钮「定位依据」→ `onLocateEvidence(question)`

- [ ] **Step 3: `ExportToolbar.jsx`**

```javascript
// props: bundle, draftId, disabled, onIncludeEvidenceChange
async function download(variant) {
    const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            variant,
            bundle,
            includeEvidence: bundle.exportPrefs.includeEvidenceInTeacher,
        }),
    })
    if (!res.ok) { /* 读 JSON message 显示 */ return }
    const blob = await res.blob()
    // 用 Content-Disposition 或默认文件名触发下载
}
```

三个按钮：学生 Word、教师 Word、PDF；勾选「教师版含原文依据」。

- [ ] **Step 4: Commit**

```bash
git add app/components/workshop/
git commit -m "feat: add workshop editor and export toolbar components"
```

---

## Task 8: 备课工作台页面 `/workshop`

**Files:**
- Create: `app/workshop/page.jsx`

- [ ] **Step 1: 创建页面骨架**

Query params：`quizType`, `difficulty`, `numQuestions`, `draftId`（与 quiz 相同）。

状态：`bundle`, `isLoading`, `generationKey`, `activeSourcePosition`, `activeQuestionMeta`。

- [ ] **Step 2: 加载与生成**

1. 读 `parsedDocument:${draftId}`；无则错误态「返回首页」  
2. 读 `articleMeta:${draftId}`（可选）  
3. 读 `workshop:${draftId}` — 若有则直接 `setBundle`（跳过 API）  
4. 否则调用 `/api/chat`（复用 `useQuizGeneration` 或内联同逻辑）  
5. 成功后 `createWorkshopBundle` + `saveWorkshopBundle`

- [ ] **Step 3: 编辑持久化**

`useEffect` debounce 500ms：`saveWorkshopBundle(draftId, bundle)`。

- [ ] **Step 4: 布局**

```jsx
<div className="mx-auto max-w-[1360px] grid lg:grid-cols-[2fr_3fr] gap-6">
  <DocumentViewer ... revealMode="all" revealedQuestionIds={allIds} isAllSubmitted />
  <div>
    <WorkshopMetaForm />
    <p className="text-xs text-amber-200/90">修改题干后，建议重新核对原文依据。</p>
    {bundle.questions.map((q, i) => <QuestionEditor key={i} ... />)}
    <ExportToolbar />
    <div className="flex gap-2 mt-4">
      <button onClick={() => setGenerationKey(k=>k+1)}>重新生成</button>
      <Link href={`/quiz?${searchParams}`}>在线预览</Link>
      <Link href="/">返回首页</Link>
    </div>
  </div>
</div>
```

加载中：复用 `LoadingScreen` + `buildPhaseCopy(elapsedSeconds)`。

- [ ] **Step 5: 手动验证**

1. 首页上传 DOCX → 进入 `/workshop`  
2. 等待生成 → 改一题题干 → 刷新页面 → 改动仍在  
3. 导出三个文件  

- [ ] **Step 6: Commit**

```bash
git add app/workshop/page.jsx
git commit -m "feat: add teacher workshop page with edit and export"
```

---

## Task 9: 路由与文案改造

**Files:**
- Modify: `app/page.jsx`
- Modify: `app/reading/[id]/page.jsx`
- Modify: `app/reading-hub/page.jsx`
- Modify: `app/quiz/page.jsx`
- Modify: `app/layout.jsx`（可选）

- [ ] **Step 1: `app/page.jsx`**

- 标题改为「AI 初中英语备课助手」；副标题强调教师/export  
- 主按钮文案：「生成并进入备课台」  
- `router.push` 目标改为 `/workshop?...`（第 53–55 行）  
- 表单下增加 Link：「想在线做一遍？预览模式」→ `/quiz?...`（需 `draftId` 时说明需先备课生成，或链到说明）

- [ ] **Step 2: `app/reading/[id]/page.jsx`**

- 按钮文案：「用此文备课（阅读理解）」/「用此文备课（完形填空）」  
- `router.push` → `/workshop?...`（第 85–87 行）  
- `action=quiz` 的 auto 逻辑改为 `action=workshop` 或保留 quiz 参数名但跳转 workshop

- [ ] **Step 3: `app/reading-hub/page.jsx`**

- 标题下加一句：「选一篇作为阅读材料，进入备课台生成 printable 练习」

- [ ] **Step 4: `app/quiz/page.jsx` 顶栏**

在题目区上方增加 info banner：

```jsx
<p className="rounded border border-cyan-400/40 bg-cyan-500/10 p-3 text-sm text-cyan-100">
  教师打印请使用 <Link href={workshopHref} className="underline">备课工作台</Link> 导出 Word/PDF。
</p>
```

`workshopHref` 用当前 query 拼 `/workshop?...`。

- [ ] **Step 5: Commit**

```bash
git add app/page.jsx app/reading/[id]/page.jsx app/reading-hub/page.jsx app/quiz/page.jsx app/layout.jsx
git commit -m "feat: route teachers to workshop and update copy"
```

---

## Task 10: README 与手动验收清单

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新 README**

新增章节：

- **教师备课流程**（工作台 → 审阅 → 导出）  
- **导出说明**（三文件、含依据开关、导出不计次、重新生成计次）  
- **PDF 本地限制**（Chromium / Vercel）  
- 更新路由表含 `/workshop`

- [ ] **Step 2: 完整手动验收**（打勾）

| # | 步骤 | 预期 |
|---|------|------|
| 1 | 首页粘贴短文 → 备课台 | 生成 5 道阅读题 |
| 2 | 改题干 + 刷新 | 改动保留 |
| 3 | 导出学生 Word | 无答案，可编辑 |
| 4 | 导出教师 Word（含依据） | 有答案、解析、依据句 |
| 5 | 取消含依据再导出教师版 | 无依据块 |
| 6 | 导出 PDF | 可打印，与 student 内容一致 |
| 7 | Reading Hub 选文 → 备课 | 进入 workshop |
| 8 | 上传 PDF | 原文面板有行号 |
| 9 | 完形 10 空 | 导出版式正常 |
| 10 | `/quiz` 预览 | banner 链回 workshop |
| 11 | 重新生成 | 消耗 1 次额度 |
| 12 | 连续导出 3 次 | 不额外扣额度 |

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document teacher workshop and export workflow"
```

---

## Spec Coverage（自检）

| Spec 要求 | 计划任务 |
|-----------|----------|
| `/workshop` 主路径 | Task 8, 9 |
| WorkshopBundle + sessionStorage | Task 1, 8 |
| 网页编辑 + Word 可编辑 | Task 7, 4 |
| 学生/教师 Word + PDF | Task 4–6, 7 |
| 可选原文依据 | Task 4 formatters, 7 ExportToolbar |
| B+C 材料来源 | Task 9（跳转不变，仅路径） |
| `/quiz` 副路径 | Task 9 |
| 重新生成计次 / 导出不计次 | Task 8 复用 `/api/chat`；README Task 10 |
| 教材单元 Phase 2 | 未纳入（符合 spec） |

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-20-junior-english-teacher-workshop.md`.

**两种执行方式：**

1. **Subagent-Driven（推荐）** — 每个 Task 派发独立子代理，任务间你做验收，迭代快。  
2. **Inline Execution** — 在本对话中按 Task 1→10 顺序实现，每 2–3 个 Task 设检查点。

你希望我按哪种方式开始写代码？
