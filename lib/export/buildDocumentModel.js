import { formatChoiceLine, getChoiceLabel, evidenceLines } from './formatters.js'

/**
 * Build a language-agnostic document model from a WorkshopBundle.
 * The output is consumed by renderDocx and renderHtml.
 *
 * Returns:
 * {
 *   title, subtitle, quizType, isTeacher, includeEvidence,
 *   passageParagraphs: string[],
 *   questionBlocks: Array<{
 *     number: number,
 *     query: string,
 *     choices: string[],   // formatted "A. ..."
 *     answerLine?: string, // teacher only
 *     explanationLines?: string[], // teacher only
 *     evidenceLines?: string[],    // teacher only if includeEvidence
 *     blankIndex?: number,         // cloze
 *   }>
 * }
 */
export function buildDocumentModel(bundle, { variant }) {
    const isTeacher = variant === 'teacher'
    const includeEvidence =
        isTeacher && (bundle.exportPrefs?.includeEvidenceInTeacher ?? true)

    const meta = bundle.meta || {}
    const passageText = bundle.passage?.plainText || ''
    const passageParagraphs = passageText
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)

    const questions = bundle.questions || []
    const questionBlocks = questions.map((q, idx) => {
        const number = idx + 1
        const choices = (q.choices || []).map((c, i) => formatChoiceLine(i, c))
        const block = {
            number,
            query: q.query || '',
            choices,
            blankIndex: q.blankIndex != null ? q.blankIndex : undefined,
        }

        if (isTeacher) {
            const answerIdx = q.answer ?? 0
            block.answerLine = `答案：${getChoiceLabel(answerIdx)}. ${q.choices?.[answerIdx] || ''}`
            if (q.explanationZh) {
                block.explanationLines = [`解析：${q.explanationZh}`]
            }
            const ev = evidenceLines(q, includeEvidence)
            if (ev.length) block.evidenceLines = ev
        }

        return block
    })

    return {
        title: meta.title || '英语练习',
        subtitle: meta.subtitle || '',
        quizType: meta.quizType || 'reading',
        isTeacher,
        includeEvidence,
        passageParagraphs,
        questionBlocks,
    }
}
