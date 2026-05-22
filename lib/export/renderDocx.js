import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    Header,
    TabStopType,
    TabStopPosition,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    UnderlineType,
} from 'docx'

const EN_FONT = 'Times New Roman'
const ZH_FONT = 'SimSun'
const BODY_SIZE = 24   // half-points = 12pt
const HEAD_SIZE = 28   // 14pt

function run(text, opts = {}) {
    return new TextRun({
        text,
        font: opts.zh ? ZH_FONT : EN_FONT,
        size: opts.size || BODY_SIZE,
        bold: opts.bold || false,
        italics: opts.italic || false,
        underline: opts.underline ? { type: UnderlineType.SINGLE } : undefined,
    })
}

function para(runs, opts = {}) {
    return new Paragraph({
        children: Array.isArray(runs) ? runs : [runs],
        alignment: opts.align || AlignmentType.JUSTIFIED,
        heading: opts.heading || undefined,
        spacing: { after: opts.spacingAfter ?? 120, line: opts.line ?? 360 },
        indent: opts.indent ? { firstLine: 480 } : undefined,
    })
}

function blankLine() {
    return new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 80 } })
}

function buildHeader(title) {
    return new Header({
        children: [
            new Paragraph({
                children: [
                    new TextRun({ text: title, font: EN_FONT, size: 20 }),
                    new TextRun({ text: '\t', font: EN_FONT, size: 20 }),
                    new TextRun({
                        text: '姓名：____________   班级：____________',
                        font: ZH_FONT,
                        size: 20,
                    }),
                ],
                tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
                spacing: { after: 0 },
            }),
        ],
    })
}

// ─── Build blank map from questions ───────────────────────────────────────
// Returns Map<"page-line", [{blankIndex, charStart, charEnd, precision, answer}]>
function buildBlankMap(questions) {
    const map = new Map()
    for (const q of questions) {
        const sp = q.sourcePosition
        if (!sp) continue
        const key = `${sp.page}-${sp.lineStart}`
        if (!map.has(key)) map.set(key, [])
        const answerWord = sp.quote || (typeof q.answer === 'number' ? q.choices?.[q.answer] : '') || ''
        map.get(key).push({
            blankIndex: q.blankIndex,
            charStart: sp.charStart ?? 0,
            charEnd: sp.charEnd ?? 0,
            precision: sp.precision || 'approximate',
            answer: answerWord,
        })
    }
    return map
}

// ─── Build TextRun array for one line with inline blanks ───────────────────
function buildLineRuns(lineText, blanks, isTeacher) {
    if (!blanks || blanks.length === 0) {
        return [run(lineText)]
    }

    const exact = blanks
        .filter(b => b.precision === 'exact' && b.charEnd > b.charStart && b.charStart >= 0)
        .sort((a, b) => a.charStart - b.charStart)
    const approx = blanks.filter(
        b => !(b.precision === 'exact' && b.charEnd > b.charStart && b.charStart >= 0)
    )

    const runs = []
    let cursor = 0

    for (const blank of exact) {
        const s = Math.max(cursor, blank.charStart)
        const e = Math.max(s, Math.min(lineText.length, blank.charEnd))
        if (s > cursor) runs.push(run(lineText.slice(cursor, s)))
        runs.push(...buildBlankRuns(blank, isTeacher))
        cursor = e
    }
    if (cursor < lineText.length) runs.push(run(lineText.slice(cursor)))

    for (const blank of approx) {
        runs.push(run(' '))
        runs.push(...buildBlankRuns(blank, isTeacher))
    }

    return runs
}

// Build the underline blank TextRuns: ___N___ or ___answer___ (teacher)
function buildBlankRuns(blank, isTeacher) {
    const displayText = isTeacher
        ? `  ${blank.answer || String(blank.blankIndex)}  `
        : `  ${blank.blankIndex}  `
    return [
        new TextRun({
            text: displayText,
            font: EN_FONT,
            size: BODY_SIZE,
            bold: true,
            underline: { type: UnderlineType.SINGLE },
        }),
    ]
}

// ─── Render cloze: passage with inline blanks + options table ──────────────
async function renderClozeDocx(documentModel) {
    const { title, subtitle, isTeacher, passageParagraphs, questionBlocks, bundle } = documentModel
    const children = []

    // Title
    children.push(para([run(title, { size: HEAD_SIZE, bold: true })], { align: AlignmentType.CENTER, spacingAfter: 60 }))
    if (subtitle) {
        children.push(para([run(subtitle, { size: 22, zh: true })], { align: AlignmentType.CENTER, spacingAfter: 80 }))
    }
    if (isTeacher) {
        children.push(para([run('（教师版）', { size: 22, zh: true, bold: true })], { align: AlignmentType.CENTER, spacingAfter: 120 }))
    }

    // Section heading
    const total = questionBlocks.length
    children.push(
        para(
            [run(`第一节  完形填空（共 ${total} 题）`, { zh: true, bold: true })],
            { spacingAfter: 120 }
        )
    )

    // ── Passage with inline blanks ──────────────────────────────────
    const questions = bundle?.questions?.filter(q => q.questionType === 'cloze') || []
    const blankMap = buildBlankMap(questions)
    const parsedDocument = bundle?.passage?.parsedDocument
    const plainText = bundle?.passage?.plainText || ''

    if (parsedDocument?.pages?.length) {
        // Group lines into paragraphs (split on empty lines)
        const allLines = []
        for (const page of parsedDocument.pages) {
            for (const line of page.lines) {
                const key = `${page.pageNumber}-${line.lineNumber}`
                allLines.push({ text: line.text, blanks: blankMap.get(key) || [], isEmpty: !line.text?.trim() })
            }
        }

        let currentParaRuns = []
        const flushPara = () => {
            if (currentParaRuns.length > 0) {
                children.push(new Paragraph({
                    children: currentParaRuns,
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { after: 160, line: 380 },
                    indent: { firstLine: 480 },
                }))
                currentParaRuns = []
            }
        }

        for (const line of allLines) {
            if (line.isEmpty) {
                flushPara()
            } else {
                if (currentParaRuns.length > 0) currentParaRuns.push(run(' '))
                currentParaRuns.push(...buildLineRuns(line.text, line.blanks, isTeacher))
            }
        }
        flushPara()
    } else if (plainText) {
        // Fallback: plain text paragraphs (no inline blank positions)
        const paras = plainText.split(/\n+/).map(s => s.trim()).filter(Boolean)
        for (const p of paras) {
            children.push(para([run(p)], { spacingAfter: 160, indent: true }))
        }
    } else {
        for (const p of passageParagraphs) {
            children.push(para([run(p)], { spacingAfter: 160, indent: true }))
        }
    }

    children.push(blankLine())

    // ── Options section ─────────────────────────────────────────────
    children.push(
        para(
            [run('请选择最佳选项：', { zh: true, bold: true })],
            { spacingAfter: 80 }
        )
    )

    for (const block of questionBlocks) {
        // Question number + stem
        const numLabel = block.blankIndex != null ? `${block.blankIndex}.` : `${block.number}.`

        // Choices in 4 columns
        const cells = block.choices.map((choice, ci) => {
            const label = ['A', 'B', 'C', 'D'][ci] || String(ci + 1)
            const isCorrect = isTeacher && ci === (block._answerIdx ?? -1)
            return new TableCell({
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `${label}. ${choice}`,
                                font: EN_FONT,
                                size: BODY_SIZE,
                                bold: isCorrect,
                                underline: isCorrect ? { type: UnderlineType.SINGLE } : undefined,
                            }),
                        ],
                        spacing: { after: 0 },
                    }),
                ],
                width: { size: 25, type: WidthType.PERCENTAGE },
                borders: {
                    top: { style: BorderStyle.NONE, size: 0 },
                    bottom: { style: BorderStyle.NONE, size: 0 },
                    left: { style: BorderStyle.NONE, size: 0 },
                    right: { style: BorderStyle.NONE, size: 0 },
                },
            })
        })

        // Row: number + 4 choices (add stem cell at start)
        const numberCell = new TableCell({
            children: [
                new Paragraph({
                    children: [new TextRun({ text: numLabel, font: EN_FONT, size: BODY_SIZE, bold: true })],
                    spacing: { after: 0 },
                }),
            ],
            width: { size: 8, type: WidthType.PERCENTAGE },
            borders: {
                top: { style: BorderStyle.NONE, size: 0 },
                bottom: { style: BorderStyle.NONE, size: 0 },
                left: { style: BorderStyle.NONE, size: 0 },
                right: { style: BorderStyle.NONE, size: 0 },
            },
        })

        children.push(
            new Table({
                rows: [new TableRow({ children: [numberCell, ...cells] })],
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                    top: { style: BorderStyle.NONE, size: 0 },
                    bottom: { style: BorderStyle.NONE, size: 0 },
                    left: { style: BorderStyle.NONE, size: 0 },
                    right: { style: BorderStyle.NONE, size: 0 },
                    insideH: { style: BorderStyle.NONE, size: 0 },
                    insideV: { style: BorderStyle.NONE, size: 0 },
                },
            })
        )

        // Teacher: answer + explanation
        if (isTeacher && block.answerLine) {
            children.push(
                para(
                    [run(`    ${block.answerLine}`, { bold: true, zh: true })],
                    { spacingAfter: 40 }
                )
            )
            for (const line of block.explanationLines || []) {
                children.push(para([run(`    ${line}`, { zh: true, size: 22 })], { spacingAfter: 60 }))
            }
        }
        children.push(blankLine())
    }

    const doc = new Document({
        sections: [{ headers: { default: buildHeader(title) }, children }],
        styles: {
            default: {
                document: {
                    run: { font: EN_FONT, size: BODY_SIZE },
                    paragraph: { spacing: { line: 360 } },
                },
            },
        },
    })
    return Packer.toBuffer(doc)
}

// ─── Render reading: original layout ──────────────────────────────────────
async function renderReadingDocx(documentModel) {
    const { title, subtitle, isTeacher, passageParagraphs, questionBlocks } = documentModel
    const children = []

    children.push(para([run(title, { size: HEAD_SIZE, bold: true })], { align: AlignmentType.CENTER, spacingAfter: 80 }))
    if (subtitle) {
        children.push(para([run(subtitle, { size: 22, zh: true })], { align: AlignmentType.CENTER, spacingAfter: 120 }))
    }
    if (isTeacher) {
        children.push(para([run('（教师版）', { size: 22, zh: true, bold: true })], { align: AlignmentType.CENTER, spacingAfter: 160 }))
    }

    children.push(
        para([run('Part I  Read the passage and answer the questions.', { bold: true })], { spacingAfter: 100 })
    )
    for (const p of passageParagraphs) {
        children.push(para([run(p)], { spacingAfter: 100 }))
    }
    children.push(blankLine())
    children.push(para([run('Part II  Choose the best answer.', { bold: true })], { spacingAfter: 100 }))

    for (const block of questionBlocks) {
        children.push(para([run(`${block.number}. ${block.query}`)], { spacingAfter: 60 }))

        // 2×2 table for choices
        const rows = []
        for (let i = 0; i < block.choices.length; i += 2) {
            const cells = [block.choices[i], block.choices[i + 1] || ''].map(c =>
                new TableCell({
                    children: [new Paragraph({ children: [run(c)], spacing: { after: 0 } })],
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.NONE, size: 0 },
                        bottom: { style: BorderStyle.NONE, size: 0 },
                        left: { style: BorderStyle.NONE, size: 0 },
                        right: { style: BorderStyle.NONE, size: 0 },
                    },
                })
            )
            rows.push(new TableRow({ children: cells }))
        }
        children.push(
            new Table({
                rows,
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                    top: { style: BorderStyle.NONE, size: 0 },
                    bottom: { style: BorderStyle.NONE, size: 0 },
                    left: { style: BorderStyle.NONE, size: 0 },
                    right: { style: BorderStyle.NONE, size: 0 },
                    insideH: { style: BorderStyle.NONE, size: 0 },
                    insideV: { style: BorderStyle.NONE, size: 0 },
                },
            })
        )

        if (isTeacher && block.answerLine) {
            children.push(blankLine())
            children.push(para([run(block.answerLine, { bold: true, zh: true })], { spacingAfter: 60 }))
            for (const line of block.explanationLines || []) {
                children.push(para([run(line, { zh: true })], { spacingAfter: 60 }))
            }
            for (const line of block.evidenceLines || []) {
                children.push(para([run(line, { zh: true, italic: true, size: 20 })], { spacingAfter: 60 }))
            }
        }
        children.push(blankLine())
    }

    const doc = new Document({
        sections: [{ headers: { default: buildHeader(title) }, children }],
        styles: {
            default: {
                document: {
                    run: { font: EN_FONT, size: BODY_SIZE },
                    paragraph: { spacing: { line: 360 } },
                },
            },
        },
    })
    return Packer.toBuffer(doc)
}

// ─── Public entry point ────────────────────────────────────────────────────
export async function renderDocxBuffer(documentModel) {
    if (documentModel.quizType === 'cloze') {
        return renderClozeDocx(documentModel)
    }
    return renderReadingDocx(documentModel)
}
