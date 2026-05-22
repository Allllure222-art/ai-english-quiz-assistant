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
} from 'docx'

const EN_FONT = 'Times New Roman'
const ZH_FONT = 'SimSun'
const BODY_SIZE = 24   // half-points (= 12pt)
const HEAD_SIZE = 28   // 14pt

function textRun(text, opts = {}) {
    return new TextRun({
        text,
        font: opts.zh ? ZH_FONT : EN_FONT,
        size: opts.size || BODY_SIZE,
        bold: opts.bold || false,
        italics: opts.italic || false,
    })
}

function paragraph(runs, opts = {}) {
    return new Paragraph({
        children: Array.isArray(runs) ? runs : [runs],
        alignment: opts.align || AlignmentType.LEFT,
        heading: opts.heading || undefined,
        spacing: { after: opts.spacingAfter ?? 120 },
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
                    new TextRun({ text: '姓名：____________   班级：____________', font: ZH_FONT, size: 20 }),
                ],
                tabStops: [
                    { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
                ],
                spacing: { after: 0 },
            }),
        ],
    })
}

export async function renderDocxBuffer(documentModel) {
    const {
        title,
        subtitle,
        quizType,
        isTeacher,
        passageParagraphs,
        questionBlocks,
    } = documentModel

    const children = []

    // Title
    children.push(
        paragraph(
            [textRun(title, { size: HEAD_SIZE, bold: true })],
            { align: AlignmentType.CENTER, spacingAfter: 80 }
        )
    )
    if (subtitle) {
        children.push(
            paragraph([textRun(subtitle, { size: 22, zh: true })], {
                align: AlignmentType.CENTER,
                spacingAfter: 120,
            })
        )
    }
    if (isTeacher) {
        children.push(
            paragraph(
                [textRun('（教师版）', { size: 22, zh: true, bold: true })],
                { align: AlignmentType.CENTER, spacingAfter: 160 }
            )
        )
    }

    // Passage section heading
    children.push(
        paragraph(
            [textRun(quizType === 'cloze' ? 'Part I  Complete the passage.' : 'Part I  Read the passage and answer the questions.', { bold: true })],
            { spacingAfter: 100 }
        )
    )

    // Passage paragraphs
    for (const para of passageParagraphs) {
        children.push(
            paragraph([textRun(para)], { spacingAfter: 100 })
        )
    }

    children.push(blankLine())

    // Questions section heading
    children.push(
        paragraph(
            [textRun(quizType === 'cloze' ? 'Part II  Choose the best answer for each blank.' : 'Part II  Choose the best answer.', { bold: true })],
            { spacingAfter: 100 }
        )
    )

    // Question blocks
    for (const block of questionBlocks) {
        const prefix = block.blankIndex != null
            ? `第 ${block.blankIndex} 空　`
            : `${block.number}. `

        // Question stem
        children.push(
            paragraph([textRun(prefix + block.query)], { spacingAfter: 60 })
        )

        // Choices (2 per row for reading, 4 in column for cloze)
        if (quizType === 'reading') {
            // 2 × 2 table for choices
            const rows = []
            for (let i = 0; i < block.choices.length; i += 2) {
                const cells = [block.choices[i], block.choices[i + 1] || ''].map(
                    (c) =>
                        new TableCell({
                            children: [new Paragraph({ children: [textRun(c)], spacing: { after: 0 } })],
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
        } else {
            for (const choice of block.choices) {
                children.push(paragraph([textRun('    ' + choice)], { spacingAfter: 40 }))
            }
        }

        // Teacher-only: answer + explanation + evidence
        if (isTeacher && block.answerLine) {
            children.push(blankLine())
            children.push(
                paragraph([textRun(block.answerLine, { bold: true, zh: true })], { spacingAfter: 60 })
            )
            for (const line of block.explanationLines || []) {
                children.push(
                    paragraph([textRun(line, { zh: true })], { spacingAfter: 60 })
                )
            }
            for (const line of block.evidenceLines || []) {
                children.push(
                    paragraph(
                        [textRun(line, { zh: true, italic: true, size: 20 })],
                        { spacingAfter: 60 }
                    )
                )
            }
        }

        children.push(blankLine())
    }

    const doc = new Document({
        sections: [
            {
                headers: { default: buildHeader(title) },
                children,
            },
        ],
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
