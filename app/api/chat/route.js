import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { buildUsageKey, consumeDailyQuota } from '../../../lib/rateLimit'
import { validateQuizPayload } from '../../../lib/quizSchema'
import { attachEvidencePositions } from '../../../lib/evidenceLocator'

export const runtime = 'nodejs'

export async function POST(request) {
    if (!process.env.OPENAI_API_KEY) {
        return Response.json(
            {
                code: 'MISSING_OPENAI_API_KEY',
                message:
                    '服务端未配置 OPENAI_API_KEY，请先在 .env.local 中配置后重启服务。',
            },
            { status: 500 }
        )
    }

    const { quizType, difficulty, numQuestions, parsedDocument } =
        await request.json()

    const session = await getServerSession(authOptions)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const userAgent = request.headers.get('user-agent') || ''
    const usageKey = buildUsageKey({
        userId: session?.user?.email || session?.user?.name,
        ip,
        userAgent,
    })
    const quotaResult = consumeDailyQuota(usageKey, Boolean(session?.user))
    if (!quotaResult.allowed) {
        const message = session?.user
            ? `你今日出题次数已达上限（${quotaResult.limit} 次），请明天再来。`
            : `游客今日可免费生成 ${quotaResult.limit} 次，你已用完。请先登录后继续（登录用户每日 ${20} 次）。`
        return Response.json(
            {
                message,
                code: 'DAILY_LIMIT_REACHED',
            },
            { status: 429 }
        )
    }

    const isCloze = quizType === 'cloze'
    const levelMap = {
        beginner: '初级（CEFR A1-A2）',
        intermediate: '中级（CEFR B1-B2）',
        advanced: '高级（CEFR C1）',
    }
    const documentText = parsedDocument?.promptText || ''
    const hasPassage = Boolean(documentText)
    const questionCount = isCloze
        ? [10, 15, 20].includes(Number(numQuestions))
            ? Number(numQuestions)
            : 20
        : [4, 5].includes(Number(numQuestions))
          ? Number(numQuestions)
          : 5

const readingPrompt = `你是一名中考英语命题老师。请基于给定材料生成 exactly ${questionCount} 道"阅读理解"单选题（初中学段）。
子题型分布要求：
- detail（细节理解）至少 1 题
- main_idea（主旨大意）至少 1 题
- inference（推理判断）至少 1 题
- vocabulary_in_context（词义猜测）至少 1 题
其余题可在上述子题型中自由分配。

输出要求：
1) 每题字段必须包含：
{
  "questionType": "reading",
  "subType": "detail | main_idea | inference | vocabulary_in_context",
  "query": "题干",
  "choices": ["A","B","C","D"],
  "answer": 0,
  "explanationZh": "中文解析",
  "sourceEvidence": "原文依据句",
  "sourcePosition": {
    "page": 1,
    "lineStart": 1,
    "lineEnd": 1,
    "charStart": 0,
    "charEnd": 0,
    "quote": "证据短语",
    "precision": "exact"
  }
}
2) 只输出一个 JSON 对象，根字段为 questions，格式：
{ "questions": [ ... ] }
3) 严禁输出 markdown、注释、额外解释。
4) 若无法精确坐标，precision 用 "approximate"，charStart/charEnd 设为 0。`

const clozePrompt = `你是一名中考英语命题老师。请基于给定材料设计 exactly ${questionCount} 道完形填空单选题（初中学段）。

【命题步骤】
Step 1：从原文中按出现顺序选出 ${questionCount} 个适合命题的词（优先选动词、名词、形容词、介词等实词）。
Step 2：将每个选中的词作为一个空，blankIndex 从 1 到 ${questionCount} 按原文顺序递增。
Step 3：精确记录该词在原文中的位置，填写 sourcePosition。

【字段要求】
- sourcePosition.quote：必须填写被删除的原词（即正确答案），禁止为空
- sourcePosition.charStart / charEnd：该词在原文对应行文本中的字符索引（从 0 开始，charEnd = 词末位置+1）
- sourcePosition.precision：能精确定位到词填 "exact"；无法精确才填 "approximate"（此时 charStart/charEnd 设 0）
- query：含该空的完整句子上下文，用 ____ 表示空位
- choices：4 个选项，其中一个是 sourcePosition.quote 对应的正确答案
- answer：正确答案在 choices 中的 0 索引
- explanationZh：简短中文解析，不超过 30 字

【每题 JSON 格式】
{
  "questionType": "cloze",
  "blankIndex": 1,
  "query": "Tom ____ to school yesterday.",
  "choices": ["went","go","goes","going"],
  "answer": 0,
  "explanationZh": "过去时用过去式",
  "sourceEvidence": "被删词所在的完整原文句子",
  "sourcePosition": {
    "page": 1,
    "lineStart": 3,
    "lineEnd": 3,
    "charStart": 4,
    "charEnd": 8,
    "quote": "went",
    "precision": "exact"
  }
}

只输出一个 JSON 对象，根字段为 questions。严禁输出 markdown、代码块或额外文字。`

    const prompt = `学段：初中。难度：${
        levelMap[difficulty] || '中级（CEFR B1-B2）'
    }。
${isCloze ? clozePrompt : readingPrompt}

阅读材料如下（可能为空）：
${hasPassage ? documentText : '无'}`

    const maxOutputTokens = isCloze
        ? Math.min(4096, 900 + questionCount * 180)
        : 2500

    const systemMessage = {
        role: 'system',
        content:
            '你只输出一个合法 JSON 对象，根字段必须是 questions（数组）。不要输出 markdown、代码块或任何 JSON 之外的文字。',
    }

    const parseModelContent = (content) => {
        const trimmed = (content || '').trim()
        if (!trimmed) return null
        try {
            return JSON.parse(trimmed)
        } catch {
            const match = trimmed.match(/\{[\s\S]*\}/)
            if (!match) return null
            return JSON.parse(match[0])
        }
    }

    const runCompletion = async (userPrompt) => {
        const response = await fetch(
            'https://api.openai.com/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        systemMessage,
                        { role: 'user', content: userPrompt },
                    ],
                    temperature: 0.2,
                    max_tokens: maxOutputTokens,
                    stream: false,
                    n: 1,
                    response_format: { type: 'json_object' },
                }),
            }
        )
        if (!response.ok) {
            return { ok: false, error: 'OPENAI_REQUEST_FAILED' }
        }
        const json = await response.json()
        const choice = json?.choices?.[0]
        const content = choice?.message?.content || ''
        const finishReason = choice?.finish_reason
        const rawQuiz = parseModelContent(content)
        return { ok: true, rawQuiz, finishReason }
    }

    try {
        let userPrompt = prompt
        let attempt = 0
        let lastResult = null

        while (attempt < 2) {
            attempt += 1
            lastResult = await runCompletion(userPrompt)

            if (!lastResult.ok) {
                return Response.json(
                    {
                        code: 'OPENAI_REQUEST_FAILED',
                        message: '出题服务暂时不可用，请稍后重试。',
                    },
                    { status: 502 }
                )
            }

            if (!lastResult.rawQuiz) {
                if (attempt < 2) {
                    userPrompt = `${prompt}\n\n请严格只输出 JSON，根对象含 questions 数组，不要省略任何题目。`
                    continue
                }
                return Response.json(
                    {
                        code: 'INVALID_MODEL_OUTPUT',
                        message: '模型输出格式异常，请重试。',
                    },
                    { status: 422 }
                )
            }

            const validated = validateQuizPayload(
                lastResult.rawQuiz,
                isCloze ? 'cloze' : 'reading',
                questionCount
            )

            if (validated.ok) {
                const questions = attachEvidencePositions(
                    validated.data.questions,
                    parsedDocument
                )
                return Response.json({ questions })
            }

            if (
                attempt < 2 &&
                (lastResult.finishReason === 'length' ||
                    validated.message?.includes('题目数量'))
            ) {
                userPrompt = `${prompt}\n\n上一输出不完整或数量不对。请重新生成：必须恰好 ${questionCount} 道题，explanationZh 每题不超过 25 字，choices 每项尽量短。`
                continue
            }

            return Response.json(
                { code: 'QUIZ_SCHEMA_INVALID', message: validated.message },
                { status: 422 }
            )
        }

        return Response.json(
            {
                code: 'QUIZ_GENERATION_FAILED',
                message: '生成失败，请稍后重试。',
            },
            { status: 422 }
        )
    } catch (error) {
        const message =
            error instanceof SyntaxError
                ? '模型输出被截断或格式异常，请重试。'
                : '生成失败，请稍后重试。'
        return Response.json(
            { code: 'QUIZ_GENERATION_FAILED', message },
            { status: 422 }
        )
    }
}
