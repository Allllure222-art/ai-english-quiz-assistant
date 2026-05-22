/**
 * Render a printable exam-paper HTML page from the document model.
 * For cloze: passage with inline numbered blanks + options table below.
 * For reading: passage + questions.
 * Returned HTML is self-contained (inline CSS) and auto-prints on load.
 */

function escHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

// ─── Build blank map from questions ───────────────────────────────────────
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

// ─── Render one text line with inline blank HTML ───────────────────────────
function renderLineHtml(lineText, blanks, isTeacher) {
    if (!blanks || blanks.length === 0) return escHtml(lineText)

    const exact = blanks
        .filter(b => b.precision === 'exact' && b.charEnd > b.charStart && b.charStart >= 0)
        .sort((a, b) => a.charStart - b.charStart)
    const approx = blanks.filter(
        b => !(b.precision === 'exact' && b.charEnd > b.charStart && b.charStart >= 0)
    )

    let html = ''
    let cursor = 0

    for (const blank of exact) {
        const s = Math.max(cursor, blank.charStart)
        const e = Math.max(s, Math.min(lineText.length, blank.charEnd))
        if (s > cursor) html += escHtml(lineText.slice(cursor, s))
        html += blankHtml(blank, isTeacher)
        cursor = e
    }
    if (cursor < lineText.length) html += escHtml(lineText.slice(cursor))
    for (const blank of approx) {
        html += ' ' + blankHtml(blank, isTeacher)
    }
    return html
}

function blankHtml(blank, isTeacher) {
    const display = isTeacher
        ? escHtml(blank.answer || String(blank.blankIndex))
        : String(blank.blankIndex)
    return `<span class="blank" data-blank="${blank.blankIndex}">${display}</span>`
}

// ─── Render cloze HTML ─────────────────────────────────────────────────────
function renderClozeHtml(documentModel) {
    const { title, subtitle, isTeacher, questionBlocks, bundle } = documentModel

    const questions = bundle?.questions?.filter(q => q.questionType === 'cloze') || []
    const blankMap = buildBlankMap(questions)
    const parsedDocument = bundle?.passage?.parsedDocument
    const plainText = bundle?.passage?.plainText || ''

    // ── Build passage HTML ───────────────────────────────────────────
    let passageHtml = ''

    if (parsedDocument?.pages?.length) {
        // Group lines into paragraphs
        const allLines = []
        for (const page of parsedDocument.pages) {
            for (const line of page.lines) {
                const key = `${page.pageNumber}-${line.lineNumber}`
                allLines.push({ text: line.text, blanks: blankMap.get(key) || [], isEmpty: !line.text?.trim() })
            }
        }

        let currentParaHtml = ''
        const flush = () => {
            if (currentParaHtml) {
                passageHtml += `<p class="passage-para">${currentParaHtml}</p>\n`
                currentParaHtml = ''
            }
        }
        for (const line of allLines) {
            if (line.isEmpty) {
                flush()
            } else {
                if (currentParaHtml) currentParaHtml += ' '
                currentParaHtml += renderLineHtml(line.text, line.blanks, isTeacher)
            }
        }
        flush()
    } else if (plainText) {
        const paras = plainText.split(/\n+/).map(s => s.trim()).filter(Boolean)
        for (const p of paras) {
            passageHtml += `<p class="passage-para">${escHtml(p)}</p>\n`
        }
    }

    // ── Build options HTML ───────────────────────────────────────────
    let optionsHtml = ''
    for (const block of questionBlocks) {
        const num = block.blankIndex != null ? block.blankIndex : block.number
        const labels = ['A', 'B', 'C', 'D']
        const choiceCells = block.choices.map((c, i) => {
            const isCorrect = isTeacher && i === (block._answerIdx ?? -1)
            return `<td class="choice-cell${isCorrect ? ' correct' : ''}">${labels[i]}.&nbsp;${escHtml(c)}</td>`
        }).join('')
        optionsHtml += `<tr>
  <td class="q-num">${num}.</td>
  ${choiceCells}
</tr>\n`
        if (isTeacher && block.answerLine) {
            optionsHtml += `<tr class="teacher-row"><td></td><td colspan="4" class="answer-cell">${escHtml(block.answerLine)}${block.explanationLines?.length ? '　' + escHtml(block.explanationLines[0]) : ''}</td></tr>\n`
        }
    }

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${escHtml(title)}</title>
<style>
  @page { size: A4; margin: 22mm 18mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", "SimSun", serif;
    font-size: 12pt;
    line-height: 1.8;
    color: #000;
    background: #fff;
    margin: 0;
    padding: 0;
  }
  .header-line {
    display: flex;
    gap: 32pt;
    justify-content: flex-end;
    font-size: 11pt;
    margin-bottom: 8pt;
    border-bottom: 1pt solid #ccc;
    padding-bottom: 6pt;
  }
  h1 { text-align: center; font-size: 15pt; margin: 0 0 4pt; }
  h2 { text-align: center; font-size: 11pt; font-weight: normal; margin: 0 0 10pt; color: #444; }
  .section-heading { font-weight: bold; font-size: 12pt; margin: 12pt 0 10pt; }
  .passage-para {
    margin: 0 0 10pt;
    text-indent: 2em;
    text-align: justify;
  }
  /* Blank style: underline + bold number */
  .blank {
    display: inline-block;
    border-bottom: 1.5pt solid #000;
    font-weight: bold;
    min-width: 2.2em;
    text-align: center;
    padding: 0 4pt;
    margin: 0 1pt;
    cursor: default;
  }
  /* Options table */
  .options-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 12pt;
    font-size: 11.5pt;
  }
  .options-table td { padding: 2pt 4pt; vertical-align: top; }
  .q-num { width: 28pt; font-weight: bold; }
  .choice-cell { width: 23%; }
  .correct { font-weight: bold; text-decoration: underline; color: #1a4e0e; }
  .teacher-row .answer-cell {
    font-size: 10.5pt;
    color: #555;
    padding-left: 24pt;
  }
  ${isTeacher ? '.teacher-only { display: block; }' : '.teacher-only { display: none; }'}
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .options-table tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="header-line">
  <span>姓名：<span style="display:inline-block;width:80pt;border-bottom:1pt solid #000;">&nbsp;</span></span>
  <span>班级：<span style="display:inline-block;width:80pt;border-bottom:1pt solid #000;">&nbsp;</span></span>
</div>
<h1>${escHtml(title)}</h1>
${subtitle ? `<h2>${escHtml(subtitle)}</h2>` : ''}
${isTeacher ? '<p style="text-align:center;font-weight:bold;color:#555;">（教师版）</p>' : ''}
<p class="section-heading">第一节&ensp;完形填空（共&nbsp;${questionBlocks.length}&nbsp;题）</p>
${passageHtml}
<table class="options-table">
${optionsHtml}
</table>
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`
}

// ─── Render reading HTML ───────────────────────────────────────────────────
function renderReadingHtml(documentModel) {
    const { title, subtitle, passageParagraphs, questionBlocks } = documentModel

    const passageHtml = passageParagraphs
        .map(p => `<p class="passage-para">${escHtml(p)}</p>`)
        .join('\n')

    const questionsHtml = questionBlocks
        .map(block => {
            const choicesHtml = `<div class="choices-grid">${block.choices
                .map(c => `<span class="choice">${escHtml(c)}</span>`)
                .join('')}</div>`
            return `<div class="question">
  <p class="stem">${block.number}.&nbsp;${escHtml(block.query)}</p>
  ${choicesHtml}
</div>`
        })
        .join('\n')

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${escHtml(title)}</title>
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", "SimSun", serif;
    font-size: 12pt;
    line-height: 1.7;
    color: #000;
    background: #fff;
    margin: 0;
    padding: 0;
  }
  h1 { text-align: center; font-size: 16pt; margin: 0 0 4pt; }
  h2 { text-align: center; font-size: 11pt; font-weight: normal; margin: 0 0 12pt; }
  .part-heading { font-weight: bold; font-size: 12pt; margin: 16pt 0 8pt; }
  .passage-para { margin: 0 0 8pt; text-indent: 2em; text-align: justify; }
  .question { margin: 12pt 0 0; page-break-inside: avoid; }
  .stem { margin: 0 0 4pt; }
  .choices-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2pt 12pt; padding-left: 1em; }
  .choice { font-size: 11pt; }
  .name-line { display: flex; gap: 24pt; justify-content: flex-end; font-size: 11pt; margin-bottom: 8pt; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="name-line">
  <span>姓名：______________</span>
  <span>班级：______________</span>
</div>
<h1>${escHtml(title)}</h1>
${subtitle ? `<h2>${escHtml(subtitle)}</h2>` : ''}
<p class="part-heading">Part I&nbsp; Read the passage and answer the questions.</p>
${passageHtml}
<p class="part-heading">Part II&nbsp; Choose the best answer.</p>
${questionsHtml}
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`
}

// ─── Public entry point ────────────────────────────────────────────────────
export function renderHtmlForStudent(documentModel) {
    if (documentModel.quizType === 'cloze') {
        return renderClozeHtml({ ...documentModel, isTeacher: false })
    }
    return renderReadingHtml(documentModel)
}
