/**
 * Render a printable student-version HTML page from the document model.
 * Returned HTML is self-contained (inline CSS) and intended for A4 printing.
 */
export function renderHtmlForStudent(documentModel) {
    const { title, subtitle, passageParagraphs, questionBlocks, quizType } =
        documentModel

    const passageHtml = passageParagraphs
        .map((p) => `<p class="passage-para">${escHtml(p)}</p>`)
        .join('\n')

    const questionsHtml = questionBlocks
        .map((block) => {
            const prefix =
                block.blankIndex != null
                    ? `第 ${block.blankIndex} 空　`
                    : `${block.number}.&nbsp;`
            const choicesHtml =
                quizType === 'reading'
                    ? `<div class="choices-grid">${block.choices
                          .map((c) => `<span class="choice">${escHtml(c)}</span>`)
                          .join('')}</div>`
                    : `<div class="choices-col">${block.choices
                          .map((c) => `<p class="choice">${escHtml(c)}</p>`)
                          .join('')}</div>`
            return `<div class="question">
  <p class="stem">${prefix}${escHtml(block.query)}</p>
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
    font-family: 'Times New Roman', serif;
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
  .passage-para { margin: 0 0 8pt; text-indent: 2em; }
  .question { margin: 12pt 0 0; page-break-inside: avoid; }
  .stem { margin: 0 0 4pt; }
  .choices-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2pt 12pt;
    padding-left: 1em;
  }
  .choices-col { padding-left: 1em; }
  .choice { font-size: 11pt; }
  .name-line {
    display: flex;
    gap: 24pt;
    justify-content: flex-end;
    font-size: 11pt;
    margin-bottom: 8pt;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="name-line">
  <span>姓名：______________</span>
  <span>班级：______________</span>
</div>
<h1>${escHtml(title)}</h1>
${subtitle ? `<h2>${escHtml(subtitle)}</h2>` : ''}
<p class="part-heading">${
        quizType === 'cloze'
            ? 'Part I&nbsp; Complete the passage.'
            : 'Part I&nbsp; Read the passage and answer the questions.'
    }</p>
${passageHtml}
<p class="part-heading">${
        quizType === 'cloze'
            ? 'Part II&nbsp; Choose the best answer for each blank.'
            : 'Part II&nbsp; Choose the best answer.'
    }</p>
${questionsHtml}
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`
}

function escHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}
