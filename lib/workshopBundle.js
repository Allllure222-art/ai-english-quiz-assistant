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
        meta: defaultBundleMeta({
            quizType,
            difficulty,
            numQuestions,
            title: title || articleMeta?.title,
        }),
        passage: { plainText, parsedDocument },
        questions,
        exportPrefs: { includeEvidenceInTeacher: true },
        articleMeta: articleMeta || null,
    }
}

export function saveWorkshopBundle(draftId, bundle) {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(
        `${STORAGE_PREFIX}${draftId}`,
        JSON.stringify(bundle)
    )
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
