import { z } from 'zod'

const metaSchema = z.object({
    title: z.string().min(1).max(200),
    quizType: z.enum(['reading', 'cloze']),
    difficulty: z.string().optional(),
    numQuestions: z.number().optional(),
    createdAt: z.string().optional(),
    subtitle: z.string().optional(),
})

const bundleSchema = z.object({
    meta: metaSchema,
    passage: z.object({ plainText: z.string() }),
    questions: z.array(z.any()).min(1).max(30),
    exportPrefs: z
        .object({ includeEvidenceInTeacher: z.boolean().optional() })
        .optional(),
})

const MAX_BODY_BYTES = 800_000

export function validateExportRequest(body) {
    const json = JSON.stringify(body)
    if (json.length > MAX_BODY_BYTES) {
        return { ok: false, message: '导出内容过大，请减少材料或题量。' }
    }
    if (!body?.bundle) {
        return { ok: false, message: '缺少 bundle 字段。' }
    }
    const result = bundleSchema.safeParse(body.bundle)
    if (!result.success) {
        return {
            ok: false,
            message: '题目数据无效，请在工作台检查后重试。',
        }
    }
    return { ok: true }
}
