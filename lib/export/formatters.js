const CHOICE_LABELS = ['A', 'B', 'C', 'D']

export function formatChoiceLine(index, text) {
    return `${CHOICE_LABELS[index]}. ${text}`
}

export function getChoiceLabel(index) {
    return CHOICE_LABELS[index] || String(index)
}

export function evidenceLines(question, includeEvidence) {
    if (!includeEvidence) return []
    const lines = []
    if (question.sourceEvidence) {
        lines.push(`【依据】${question.sourceEvidence}`)
    }
    const pos = question.sourcePosition
    if (pos?.page) {
        const lineRange =
            pos.lineEnd && pos.lineEnd !== pos.lineStart
                ? `${pos.lineStart}–${pos.lineEnd}`
                : String(pos.lineStart)
        lines.push(`【定位】约第 ${pos.page} 页，第 ${lineRange} 行`)
    }
    return lines
}
