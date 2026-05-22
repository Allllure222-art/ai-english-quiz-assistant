import { z } from 'zod'

const sourcePositionSchema = z.object({
    page: z.number().int().min(1),
    lineStart: z.number().int().min(1),
    lineEnd: z.number().int().min(1),
    charStart: z.number().int().min(0),
    charEnd: z.number().int().min(0),
    // For cloze, quote is the blanked word (required non-empty by the new prompt).
    // For reading, quote is the evidence phrase (also required).
    quote: z.string(),
    precision: z.enum(['exact', 'approximate']),
})

const readingQuestionSchema = z.object({
    questionType: z.literal('reading'),
    subType: z.enum([
        'detail',
        'main_idea',
        'inference',
        'vocabulary_in_context',
    ]),
    query: z.string().min(1),
    choices: z.array(z.string().min(1)).length(4),
    answer: z.number().int().min(0).max(3),
    explanationZh: z.string().min(1),
    sourceEvidence: z.string().min(1),
    sourcePosition: sourcePositionSchema,
})

const clozeQuestionSchema = z.object({
    questionType: z.literal('cloze'),
    blankIndex: z.number().int().min(1),
    query: z.string().min(1),
    choices: z.array(z.string().min(1)).length(4),
    answer: z.number().int().min(0).max(3),
    explanationZh: z.string().min(1),
    sourceEvidence: z.string(),
    sourcePosition: sourcePositionSchema,
})

const quizSchema = z.object({
    questions: z.array(z.union([readingQuestionSchema, clozeQuestionSchema])).min(1),
})

export function validateQuizPayload(
    payload,
    expectedQuestionType,
    expectedCount
) {
    const parsed = quizSchema.safeParse(payload)
    if (!parsed.success) {
        return {
            ok: false,
            message: '题目结构校验失败，请重试。',
        }
    }

    const hasMismatchedType = parsed.data.questions.some(
        (question) => question.questionType !== expectedQuestionType
    )
    if (hasMismatchedType) {
        return {
            ok: false,
            message: '题型不匹配，请重试。',
        }
    }

    const count = parsed.data.questions.length
    const expected = Number(expectedCount)
    if (expected > 0) {
        const isClozeType = expectedQuestionType === 'cloze'
        // For cloze, accept slightly fewer questions (AI may not find enough
        // blanking spots in shorter passages). Floor at 60% or expected-4.
        const minAcceptable = isClozeType
            ? Math.max(Math.floor(expected * 0.6), expected - 4, 1)
            : expected
        if (count < minAcceptable || (!isClozeType && count !== expected)) {
            return {
                ok: false,
                message: `题目数量不符合预期（期望 ${expected}，实际 ${count}）。`,
            }
        }
    }

    return {
        ok: true,
        data: parsed.data,
    }
}
