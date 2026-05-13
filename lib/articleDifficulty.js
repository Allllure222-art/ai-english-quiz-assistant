import { JUNIOR_CORE_LEMMA_SET } from './juniorCoreWords'

function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n))
}

function tokenizeWords(text) {
    return (text || '')
        .toLowerCase()
        .replace(/[^a-z0-9'\s-]/g, ' ')
        .split(/\s+/)
        .map((w) => w.replace(/^'+|'+$/g, ''))
        .filter((w) => w.length > 0)
}

/** Split on `.` `!` `?` (length / readability signal). */
function splitSentences(text) {
    const raw = (text || '').replace(/\s+/g, ' ').trim()
    if (!raw) return []
    const parts = raw
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    return parts.length ? parts : [raw]
}

function lemmaForRareCheck(word) {
    if (word.length <= 2) return word
    let w = word
        .replace(/ing$/, '')
        .replace(/ed$/, '')
        .replace(/es$/, 'e')
        .replace(/s$/, '')
    if (w.length < 3) w = word
    return w
}

/**
 * Multi-signal difficulty (0–100) → `junior_friendly` | `standard` | `challenging`.
 * Bands: 0–39 junior, 40–69 standard, 70–100 challenging.
 *
 * Bump rules: short text + very high rare ratio nudges score up; long “easy” text nudges down.
 */
export function scoreArticleDifficulty(fullText) {
    const words = tokenizeWords(fullText)
    const wordCount = words.length
    const sentences = splitSentences(fullText)
    const sentenceCount = Math.max(1, sentences.length)
    const avgSentenceLength = wordCount / sentenceCount

    let rareCount = 0
    for (const w of words) {
        const lw = w.toLowerCase()
        if (/^\d+$/.test(lw)) continue
        if (lw.length <= 2) continue
        const lemma = lemmaForRareCheck(lw)
        if (!JUNIOR_CORE_LEMMA_SET.has(lw) && !JUNIOR_CORE_LEMMA_SET.has(lemma)) {
            rareCount += 1
        }
    }
    const rareWordRatio = wordCount > 0 ? rareCount / wordCount : 0

    const abbrevHits = (fullText || '').match(/\b[A-Z]{2,}\b/g) || []
    const multiWordProper =
        (fullText || '').match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || []
    const properLikeCount = abbrevHits.length + multiWordProper.length
    const properNounDensity = wordCount > 0 ? properLikeCount / wordCount : 0

    const digitTokens = words.filter((w) => /\d/.test(w)).length
    const digitDensity = wordCount > 0 ? digitTokens / wordCount : 0

    const readingMinutes = Math.max(1, Math.ceil(wordCount / 180))

    const lengthScore = clamp((wordCount / 450) * 100, 0, 100)
    const sentenceScore = clamp(((avgSentenceLength - 10) / 16) * 100, 0, 100)
    const rareScore = clamp(rareWordRatio * 280, 0, 100)

    let difficultyScore =
        lengthScore * 0.35 + sentenceScore * 0.35 + rareScore * 0.3
    difficultyScore += clamp(properNounDensity * 90, 0, 12)
    difficultyScore += clamp(digitDensity * 120, 0, 8)
    difficultyScore = clamp(difficultyScore, 0, 100)

    if (wordCount < 180 && rareWordRatio > 0.28) {
        difficultyScore = clamp(difficultyScore + 12, 0, 100)
    }
    if (wordCount < 180 && rareWordRatio > 0.38 && avgSentenceLength > 22) {
        difficultyScore = clamp(difficultyScore + 8, 0, 100)
    }

    if (wordCount >= 320 && rareWordRatio < 0.06 && avgSentenceLength < 16) {
        difficultyScore = clamp(difficultyScore - 10, 0, 100)
    }

    let difficulty
    if (difficultyScore <= 39) difficulty = 'junior_friendly'
    else if (difficultyScore <= 69) difficulty = 'standard'
    else difficulty = 'challenging'

    const difficultyReasons = []
    if (wordCount >= 320) difficultyReasons.push('篇幅偏长')
    else if (wordCount >= 240) difficultyReasons.push('篇幅适中偏长')
    if (avgSentenceLength >= 22) difficultyReasons.push('平均句长偏长')
    else if (avgSentenceLength >= 18) difficultyReasons.push('句子略长')
    if (rareWordRatio >= 0.18) difficultyReasons.push('进阶词汇比例偏高')
    else if (rareWordRatio >= 0.12) difficultyReasons.push('生词比例略高')
    if (properNounDensity >= 0.08) difficultyReasons.push('专有名词/缩写偏多')
    if (digitDensity >= 0.12) difficultyReasons.push('数字与数据表述偏多')

    if (difficultyReasons.length === 0) {
        if (difficulty === 'junior_friendly') difficultyReasons.push('篇幅与句式较友好')
        else if (difficulty === 'standard') difficultyReasons.push('综合难度适中')
        else difficultyReasons.push('综合挑战度较高')
    }

    const metrics = {
        words: wordCount,
        avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
        rareWordRatio: Math.round(rareWordRatio * 1000) / 1000,
        readingMinutes,
    }

    return {
        difficulty,
        difficultyScore: Math.round(difficultyScore),
        difficultyReasons: difficultyReasons.slice(0, 4),
        metrics,
    }
}

export function enrichArticleDifficultyFields(normalizedContent) {
    const s = scoreArticleDifficulty(normalizedContent)
    return {
        difficulty: s.difficulty,
        difficultyScore: s.difficultyScore,
        difficultyReasons: s.difficultyReasons,
        metrics: s.metrics,
        estimatedReadingMinutes: s.metrics.readingMinutes,
    }
}
