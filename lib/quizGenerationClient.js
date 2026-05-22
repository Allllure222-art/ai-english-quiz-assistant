export const QUIZ_FETCH_TIMEOUT_MS = 120000

export function buildPhaseCopy(elapsedSeconds) {
    if (elapsedSeconds < 4) {
        return {
            title: '正在连接出题服务…',
            hint: '已收到你的材料，正在提交给模型处理。通常需要数十秒，请稍候。',
        }
    }
    if (elapsedSeconds < 25) {
        return {
            title: '正在生成题目…',
            hint: '模型正在阅读材料并编写题干与选项，请保持本页打开。',
        }
    }
    return {
        title: '仍在生成中…',
        hint: `已等待 ${elapsedSeconds} 秒。题量较大或材料较长时会更久；请勿关闭或刷新页面，以免重复占用次数。`,
    }
}

export function mapQuizFetchFailure({
    status,
    code,
    message,
    isAbort,
    isTimeout,
    isNetwork,
}) {
    if (isTimeout) {
        return {
            headline: '出题超时',
            body: '等待时间过长，本次请求已自动中断。你可以减少题量或缩短材料后，点击下方「使用同一材料重新生成」。',
            code: 'TIMEOUT',
        }
    }
    if (isAbort) {
        return {
            headline: '已取消出题',
            body: '本次生成已停止。你可调整题型或题量后，再次点击「使用同一材料重新生成」。',
            code: 'ABORTED',
        }
    }
    if (isNetwork) {
        return {
            headline: '网络异常',
            body: '无法连接到服务器。请检查本机网络、代理或防火墙后重试。',
            code: 'NETWORK',
        }
    }
    if (status === 429) {
        return {
            headline: '今日次数已用完',
            body: message || '请明日再试，或登录后使用更高额度。',
            code: code || 'DAILY_LIMIT_REACHED',
        }
    }
    if (status === 502) {
        return {
            headline: '出题服务暂时不可用',
            body:
                message ||
                '上游模型或网关返回异常（502）。请稍后重试；若持续出现，可检查 OpenAI 服务状态或减少题量。',
            code: code || 'OPENAI_REQUEST_FAILED',
        }
    }
    if (status === 422) {
        return {
            headline: '生成结果未通过校验',
            body:
                message ||
                '模型输出格式不符合要求。请重试一次；完形填空可尝试把题量从 20 降到 10～15。',
            code: code || 'QUIZ_SCHEMA_INVALID',
        }
    }
    if (status === 500) {
        return {
            headline: '服务器配置或内部错误',
            body:
                message ||
                '请检查服务端日志与环境变量（如 OPENAI_API_KEY）后重试。',
            code: code || 'SERVER_ERROR',
        }
    }
    return {
        headline: '出题失败',
        body: message || '请稍后重试。',
        code: code || 'UNKNOWN',
    }
}
