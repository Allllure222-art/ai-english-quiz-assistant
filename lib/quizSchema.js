import { z } from 'zod'

const sourcePositionSchema = z.object({
    page: z.number().int().min(1),
    lineStart: z.number().int().min(1),
    lineEnd: z.number().int().min(1),
    charStart: z.number().int().min(0),
    charEnd: z.number().int().min(0),
    quote: z.string().min(1),
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
    sourceEvidence: z.string().min(1),
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

    if (
        Number(expectedCount) > 0 &&
        parsed.data.questions.length !== Number(expectedCount)
    ) {
        return {
            ok: false,
            message: `题目数量不符合预期（期望 ${expectedCount}，实际 ${parsed.data.questions.length}）。`,
        }
    }

    return {
        ok: true,
        data: parsed.data,
    }
}
