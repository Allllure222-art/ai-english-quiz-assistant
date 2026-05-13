'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useSearchParams, useRouter } from 'next/navigation'

import { motion, useSpring } from 'framer-motion'

import LoadingScreen from '../components/LoadingScreen'
import Question from '../components/Question'

const QUIZ_FETCH_TIMEOUT_MS = 120000

function buildPhaseCopy(elapsedSeconds) {
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

function mapQuizFetchFailure({
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

const QuizPage = () => {
    const params = useSearchParams()
    const router = useRouter()

    const quizType = params.get('quizType')
    const difficulty = params.get('difficulty')
    const numQuestions = Number(params.get('numQuestions'))
    const draftId = params.get('draftId')

    const [quiz, setQuiz] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [errorDetail, setErrorDetail] = useState(null)
    const [parsedDocument, setParsedDocument] = useState(null)
    const [activeSourcePosition, setActiveSourcePosition] = useState(null)
    const [activeQuestionMeta, setActiveQuestionMeta] = useState(null)
    const [revealMode, setRevealMode] = useState('per-question')
    const [revealedQuestionIds, setRevealedQuestionIds] = useState([])
    const [isAllSubmitted, setIsAllSubmitted] = useState(false)
    const [articleMeta, setArticleMeta] = useState(null)

    const [numSubmitted, setNumSubmitted] = useState(0)
    const [numCorrect, setNumCorrect] = useState(0)

    const [progress, setProgress] = useState(0)
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const [generationKey, setGenerationKey] = useState(0)

    const abortRef = useRef(null)
    const abortKindRef = useRef('')
    const navigatedToEndRef = useRef(false)

    const scaleX = useSpring(progress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.002,
    })

    const resetQuizSessionState = useCallback(() => {
        setQuiz([])
        setErrorMessage('')
        setErrorDetail(null)
        setNumSubmitted(0)
        setNumCorrect(0)
        setProgress(0)
        setRevealedQuestionIds([])
        setIsAllSubmitted(false)
        setActiveSourcePosition(null)
        setActiveQuestionMeta(null)
    }, [])

    const handleRegenerateSameMaterial = useCallback(() => {
        navigatedToEndRef.current = false
        resetQuizSessionState()
        setGenerationKey((k) => k + 1)
    }, [resetQuizSessionState])

    const handleCancelGenerate = useCallback(() => {
        abortKindRef.current = 'user'
        abortRef.current?.abort()
    }, [])

    useEffect(() => {
        if (!draftId || !quizType) return

        let disposed = false
        let tick = null
        const ac = new AbortController()
        abortRef.current = ac
        abortKindRef.current = ''

        const timer = setTimeout(() => {
            abortKindRef.current = 'timeout'
            ac.abort()
        }, QUIZ_FETCH_TIMEOUT_MS)

        const run = async () => {
            navigatedToEndRef.current = false
            setIsLoading(true)
            setErrorMessage('')
            setErrorDetail(null)
            setElapsedSeconds(0)
            tick = setInterval(() => {
                setElapsedSeconds((s) => s + 1)
            }, 1000)

            try {
                const parsedDocumentRaw = window.sessionStorage.getItem(
                    `parsedDocument:${draftId}`
                )
                if (!parsedDocumentRaw) {
                    if (!disposed) {
                        setErrorDetail({
                            code: 'MISSING_DOCUMENT',
                            headline: '材料已失效',
                            body: '请返回首页重新粘贴或上传。',
                        })
                        setErrorMessage(
                            '未找到已解析的材料，请返回首页重新粘贴或上传文件后再试。'
                        )
                    }
                    return
                }
                const parsedDoc = JSON.parse(parsedDocumentRaw)
                if (disposed) return
                setParsedDocument(parsedDoc)
                const articleMetaRaw = window.sessionStorage.getItem(
                    `articleMeta:${draftId}`
                )
                if (articleMetaRaw) {
                    setArticleMeta(JSON.parse(articleMetaRaw))
                }

                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        quizType,
                        difficulty,
                        numQuestions,
                        parsedDocument: parsedDoc,
                    }),
                    signal: ac.signal,
                })

                const payload = await response.json().catch(() => null)

                if (!response.ok) {
                    const mapped = mapQuizFetchFailure({
                        status: response.status,
                        code: payload?.code,
                        message: payload?.message,
                    })
                    if (!disposed) {
                        setErrorDetail(mapped)
                        setErrorMessage(`${mapped.headline}。${mapped.body}`)
                    }
                    return
                }

                if (!payload?.questions?.length) {
                    const mapped = mapQuizFetchFailure({
                        status: 422,
                        message: '返回内容为空，请重试。',
                    })
                    if (!disposed) {
                        setErrorDetail(mapped)
                        setErrorMessage(`${mapped.headline}。${mapped.body}`)
                    }
                    return
                }
                if (!disposed) {
                    setQuiz(payload.questions || [])
                }
            } catch (err) {
                if (disposed) return
                if (err?.name === 'AbortError') {
                    const kind = abortKindRef.current
                    if (kind === 'unmount') return
                    const mapped = mapQuizFetchFailure({
                        isAbort: kind === 'user',
                        isTimeout: kind === 'timeout',
                    })
                    setErrorDetail(mapped)
                    setErrorMessage(`${mapped.headline}。${mapped.body}`)
                    return
                }
                const mapped = mapQuizFetchFailure({
                    isNetwork:
                        err?.message === 'Failed to fetch' ||
                        err?.name === 'TypeError',
                })
                setErrorDetail(mapped)
                setErrorMessage(`${mapped.headline}。${mapped.body}`)
            } finally {
                clearInterval(tick)
                clearTimeout(timer)
                if (!disposed) {
                    setIsLoading(false)
                }
            }
        }

        run()

        return () => {
            disposed = true
            clearInterval(tick)
            clearTimeout(timer)
            abortKindRef.current = 'unmount'
            ac.abort()
            if (abortRef.current === ac) abortRef.current = null
        }
    }, [
        quizType,
        difficulty,
        numQuestions,
        draftId,
        generationKey,
    ])

    useEffect(() => {
        setProgress(numSubmitted / (numQuestions || 1))

        if (
            numSubmitted === numQuestions &&
            numQuestions > 0 &&
            quiz.length > 0 &&
            !navigatedToEndRef.current
        ) {
            navigatedToEndRef.current = true
            const score = numCorrect / numSubmitted
            router.push(
                `/end-screen?score=${encodeURIComponent(
                    String(score)
                )}&quizType=${encodeURIComponent(quizType || 'reading')}`
            )
        }
    }, [
        numSubmitted,
        numQuestions,
        numCorrect,
        router,
        quizType,
        quiz.length,
    ])

    useEffect(() => {
        scaleX.set(progress)
    }, [progress, scaleX])

    const phase = buildPhaseCopy(elapsedSeconds)

    if (!draftId || !quizType) {
        return (
            <div className='mx-auto max-w-lg px-4 pt-20 text-center text-white/80'>
                <p>链接参数不完整（缺少材料草稿或题型），请从首页重新进入。</p>
                <button
                    type='button'
                    className='q-button !mt-6'
                    onClick={() => router.push('/')}
                >
                    返回首页
                </button>
            </div>
        )
    }

    return (
        <div>
            <motion.div className='progress-bar' style={{ scaleX }} />

            {isLoading ? (
                <LoadingScreen
                    phaseTitle={phase.title}
                    phaseHint={phase.hint}
                    elapsedSeconds={elapsedSeconds}
                    onCancel={handleCancelGenerate}
                />
            ) : (
                <div className='mx-auto max-w-[1360px] px-3 pb-12 pt-12 sm:px-4'>
                    {(errorMessage || articleMeta) && (
                        <div className='mb-6 space-y-4'>
                            {errorMessage && (
                                <div className='rounded border border-red-400/60 bg-red-500/10 p-4'>
                                    <p className='text-red-200'>{errorMessage}</p>
                                    {errorDetail?.code && (
                                        <p className='mt-2 text-xs text-white/50'>
                                            错误代码：{errorDetail.code}
                                        </p>
                                    )}
                                    <div className='mt-4 flex flex-wrap gap-2'>
                                        <button
                                            className='rounded border border-emerald-300/70 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-40'
                                            type='button'
                                            disabled={
                                                errorDetail?.code === 'MISSING_DOCUMENT'
                                            }
                                            title={
                                                errorDetail?.code === 'MISSING_DOCUMENT'
                                                    ? '材料不在本机缓存中，请从首页重新上传。'
                                                    : ''
                                            }
                                            onClick={handleRegenerateSameMaterial}
                                        >
                                            使用同一材料重新生成
                                        </button>
                                        <button
                                            className='rounded border border-white/30 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10'
                                            type='button'
                                            onClick={() => router.push('/')}
                                        >
                                            返回首页换材料
                                        </button>
                                    </div>
                                </div>
                            )}
                            {articleMeta && (
                                <div className='rounded border border-cyan-300/30 bg-cyan-300/5 p-3 text-sm'>
                                    当前材料来源：{articleMeta.sourceName} ·{' '}
                                    <a
                                        href={articleMeta.sourceUrl}
                                        target='_blank'
                                        rel='noreferrer'
                                        className='text-cyan-200 hover:underline'
                                    >
                                        查看原文
                                    </a>
                                </div>
                            )}
                        </div>
                    )}
                    {quizType === 'cloze' && (
                        <div className='mb-6 rounded border border-yellow-300/40 bg-yellow-300/5 p-3 text-sm'>
                            <div className='flex flex-wrap items-center gap-3'>
                                <span className='text-yellow-200'>答案揭晓模式：</span>
                                <button
                                    type='button'
                                    className={`rounded border px-3 py-1 ${
                                        revealMode === 'per-question'
                                            ? 'border-yellow-300 bg-yellow-300/20 text-yellow-100'
                                            : 'border-white/30 text-white/70'
                                    }`}
                                    onClick={() => {
                                        setRevealMode('per-question')
                                        setIsAllSubmitted(false)
                                        setRevealedQuestionIds([])
                                    }}
                                >
                                    逐题查看解析
                                </button>
                                <button
                                    type='button'
                                    className={`rounded border px-3 py-1 ${
                                        revealMode === 'after-all'
                                            ? 'border-yellow-300 bg-yellow-300/20 text-yellow-100'
                                            : 'border-white/30 text-white/70'
                                    }`}
                                    onClick={() => {
                                        setRevealMode('after-all')
                                        setRevealedQuestionIds([])
                                        setIsAllSubmitted(false)
                                    }}
                                >
                                    全部做完再校对
                                </button>
                                <button
                                    type='button'
                                    className='rounded border border-emerald-300 px-3 py-1 text-emerald-200 disabled:cursor-not-allowed disabled:opacity-45'
                                    disabled={
                                        revealMode !== 'after-all' ||
                                        numSubmitted < numQuestions ||
                                        isAllSubmitted
                                    }
                                    title={
                                        revealMode !== 'after-all'
                                            ? '请先在上方选择「全部做完再校对」。'
                                            : numSubmitted < numQuestions
                                              ? `还需完成 ${
                                                    numQuestions - numSubmitted
                                                } 题才能提交全部。`
                                              : isAllSubmitted
                                                ? '已提交全部，可查看左侧原文中的答案。'
                                                : ''
                                    }
                                    onClick={() => setIsAllSubmitted(true)}
                                >
                                    提交全部 / 查看全部答案
                                </button>
                            </div>
                            <p className='mt-2 text-xs leading-relaxed text-white/55'>
                                「逐题」与「全部做完」切换时，会清空「已揭晓」与「提交全部」状态，避免与新模式冲突。
                                选「全部做完再校对」时，单题解析按钮会暂时禁用，直到你点「提交全部」。
                            </p>
                        </div>
                    )}
                    <div
                        className={
                            parsedDocument
                                ? 'lg:grid lg:grid-cols-[minmax(280px,400px)_minmax(0,1fr)] lg:items-start lg:gap-6'
                                : ''
                        }
                    >
                        {parsedDocument && (
                            <aside className='mt-8 min-w-0 self-start lg:sticky lg:top-4 lg:mt-0'>
                                <DocumentViewer
                                    parsedDocument={parsedDocument}
                                    activeSourcePosition={activeSourcePosition}
                                    activeQuestionMeta={activeQuestionMeta}
                                    clozeQuestions={quiz.filter(
                                        (question) =>
                                            question.questionType === 'cloze'
                                    )}
                                    revealMode={revealMode}
                                    revealedQuestionIds={revealedQuestionIds}
                                    isAllSubmitted={isAllSubmitted}
                                    quizType={quizType}
                                />
                            </aside>
                        )}
                        <div id='quiz-questions-root' className='min-w-0'>
                            {Object.entries(groupQuestionsByType(quiz)).map(
                                ([type, questions]) => (
                                    <div key={type} className='mb-10'>
                                        <h3 className='mx-auto mb-4 max-w-3xl text-xl font-semibold text-emerald-200'>
                                            {type === 'reading'
                                                ? '阅读理解题组'
                                                : '完形填空题组'}
                                        </h3>
                                        {questions.map((question) => (
                                            <div
                                                className='mb-12'
                                                key={`${type}-${question._globalIndex}`}
                                            >
                                                <Question
                                                    question={question}
                                                    id={question._globalIndex}
                                                    setNumSubmitted={setNumSubmitted}
                                                    setNumCorrect={setNumCorrect}
                                                    revealMode={revealMode}
                                                    isAllSubmitted={isAllSubmitted}
                                                    isRevealed={revealedQuestionIds.includes(
                                                        question._globalIndex
                                                    )}
                                                    onRevealQuestion={(questionId) =>
                                                        setRevealedQuestionIds((prev) =>
                                                            prev.includes(questionId)
                                                                ? prev
                                                                : [...prev, questionId]
                                                        )
                                                    }
                                                    onLocateEvidence={(
                                                        sourcePosition,
                                                        questionMeta
                                                    ) => {
                                                        setActiveSourcePosition(
                                                            sourcePosition
                                                        )
                                                        setActiveQuestionMeta(
                                                            questionMeta
                                                        )
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

const groupQuestionsByType = (questions) => {
    const normalized = (questions || []).map((question, index) => ({
        ...question,
        _globalIndex: index,
    }))
    return normalized.reduce(
        (acc, question) => {
            const key = question.questionType || 'reading'
            acc[key].push(question)
            return acc
        },
        { reading: [], cloze: [] }
    )
}

const highlightLineText = (
    lineText,
    sourcePosition,
    isActiveLine,
    quizType,
    originalLineText
) => {
    if (!isActiveLine) {
        return lineText
    }
    if (quizType === 'cloze') {
        return lineText
    }
    const full = originalLineText || ''
    if (sourcePosition?.precision !== 'exact') {
        return (
            <span className='rounded bg-amber-300/25 px-0.5 text-white ring-1 ring-amber-200/35'>
                {full}
            </span>
        )
    }
    const start = Math.max(0, sourcePosition.charStart)
    const end = Math.min(full.length, sourcePosition.charEnd)
    if (end <= start) {
        return (
            <span className='rounded bg-amber-300/25 px-0.5 text-white ring-1 ring-amber-200/35'>
                {full}
            </span>
        )
    }

    return (
        <>
            {full.slice(0, start)}
            <mark className='rounded bg-yellow-300 px-0.5 text-black'>
                {full.slice(start, end)}
            </mark>
            {full.slice(end)}
        </>
    )
}

const DocumentViewer = ({
    parsedDocument,
    activeSourcePosition,
    activeQuestionMeta,
    clozeQuestions,
    revealMode,
    revealedQuestionIds,
    isAllSubmitted,
    quizType,
}) => {
    useEffect(() => {
        if (!activeSourcePosition) return
        const id = `source-line-${activeSourcePosition.page}-${activeSourcePosition.lineStart}`
        const target = document.getElementById(id)
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }, [activeSourcePosition])

    return (
        <div
            id='document-viewer'
            className='w-full rounded border border-white/15 bg-black/20 p-4'
        >
            <div className='mb-4 flex items-center justify-between'>
                <h3 className='text-lg font-semibold'>原文定位</h3>
                {activeSourcePosition && (
                    <p className='text-xs text-emerald-300/80'>
                        当前定位：第 {activeSourcePosition.page} 页，第{' '}
                        {activeSourcePosition.lineStart} 行
                    </p>
                )}
            </div>
            <p className='mb-3 text-xs leading-relaxed text-white/50'>
                {quizType === 'cloze'
                    ? '完形：若坐标为「近似」或无法精确到词，左侧原文行会整体弱高亮并标出空位编号，便于对照。'
                    : '若证据为「近似」定位，左侧对应行会整体弱高亮，便于在原文中自行对照。'}
            </p>
            <div className='max-h-[420px] space-y-6 overflow-auto pr-2'>
                {!parsedDocument.pages?.length ? (
                    <p className='rounded border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100/90'>
                        未解析到可展示的正文行（常见于扫描版 PDF 无文本层，或解析异常）。请换用可复制文字的
                        PDF，或直接将全文粘贴到首页文本框后再出题。
                    </p>
                ) : (
                    parsedDocument.pages.map((page) => (
                    <div
                        key={page.pageNumber}
                        className='rounded border border-white/10 p-3'
                    >
                        <h4 className='mb-2 text-sm text-emerald-200'>
                            第 {page.pageNumber} 页
                        </h4>
                        <div className='space-y-1 text-sm leading-6'>
                            {page.lines.map((line) => {
                                const lineRender = getRenderedLine({
                                    lineText: line.text,
                                    pageNumber: page.pageNumber,
                                    lineNumber: line.lineNumber,
                                    clozeQuestions,
                                    revealMode,
                                    revealedQuestionIds,
                                    isAllSubmitted,
                                    quizType,
                                })
                                const isActiveLine =
                                    activeSourcePosition &&
                                    activeSourcePosition.page ===
                                        page.pageNumber &&
                                    line.lineNumber >=
                                        activeSourcePosition.lineStart &&
                                    line.lineNumber <=
                                        activeSourcePosition.lineEnd
                                const id = `source-line-${page.pageNumber}-${line.lineNumber}`
                                return (
                                    <p
                                        id={id}
                                        key={id}
                                        className={`rounded px-2 py-1 ${
                                            isActiveLine
                                                ? 'border border-yellow-300/60 bg-yellow-300/20'
                                                : ''
                                        }`}
                                        title={
                                            activeQuestionMeta
                                                ? `题号: ${activeQuestionMeta.questionNo} | 题型: ${activeQuestionMeta.questionType} | 证据: ${activeQuestionMeta.sourceEvidence}`
                                                : ''
                                        }
                                    >
                                        <span className='mr-2 text-white/45'>
                                            L{line.lineNumber}
                                        </span>
                                        {highlightLineText(
                                            lineRender,
                                            activeSourcePosition,
                                            isActiveLine,
                                            quizType,
                                            line.text
                                        )}
                                    </p>
                                )
                            })}
                        </div>
                    </div>
                    ))
                )}
            </div>
        </div>
    )
}

function hasBadCharRange(item) {
    const s = item.start
    const e = item.end
    if (item.precision === 'approximate') return true
    if (e <= s) return true
    if (s === 0 && e === 0) return true
    return false
}

function hasOverlap(sortedByStart) {
    let prevEnd = -1
    for (const it of sortedByStart) {
        if (it.start < prevEnd) return true
        prevEnd = Math.max(prevEnd, it.end)
    }
    return false
}

const getRenderedLine = ({
    lineText,
    pageNumber,
    lineNumber,
    clozeQuestions,
    revealMode,
    revealedQuestionIds,
    isAllSubmitted,
    quizType,
}) => {
    if (quizType !== 'cloze') return lineText
    const relatedQuestions = (clozeQuestions || [])
        .filter((question) => {
            const sp = question.sourcePosition
            return (
                sp?.page === pageNumber &&
                lineNumber >= sp?.lineStart &&
                lineNumber <= sp?.lineEnd
            )
        })
        .map((question) => ({
            id: question._globalIndex,
            blankIndex: question.blankIndex || question._globalIndex + 1,
            start: question.sourcePosition?.charStart ?? 0,
            end: question.sourcePosition?.charEnd ?? 0,
            precision: question.sourcePosition?.precision,
            answer:
                question.sourcePosition?.quote ||
                question.sourceEvidence ||
                '',
        }))

    if (!relatedQuestions.length) return lineText

    const byBlank = [...relatedQuestions].sort(
        (a, b) => a.blankIndex - b.blankIndex
    )
    const byStart = [...relatedQuestions].sort(
        (a, b) => a.start - b.start || a.blankIndex - b.blankIndex
    )

    const useWholeLineMode =
        byBlank.some((q) => hasBadCharRange(q)) || hasOverlap(byStart)

    if (useWholeLineMode) {
        const ordered = [...byBlank]
        return (
            <>
                <span className='rounded bg-emerald-400/12 px-1 ring-1 ring-emerald-300/25'>
                    {lineText}
                </span>
                <span className='ml-1.5 inline-flex flex-wrap items-center gap-1 align-middle'>
                    {ordered.map((item) => {
                        const shouldReveal =
                            isAllSubmitted ||
                            (revealMode === 'per-question' &&
                                revealedQuestionIds.includes(item.id))
                        return (
                            <span
                                key={`wl-${item.id}`}
                                className='inline-flex items-center rounded border border-yellow-300/70 bg-yellow-400/15 px-1.5 py-0.5 text-xs font-semibold text-yellow-50'
                            >
                                空{item.blankIndex}
                                {shouldReveal ? (
                                    <span className='ml-1 text-emerald-100'>
                                        → {item.answer || '（无）'}
                                    </span>
                                ) : null}
                            </span>
                        )
                    })}
                </span>
            </>
        )
    }

    const sorted = [...relatedQuestions].sort(
        (a, b) => a.start - b.start || a.blankIndex - b.blankIndex
    )
    let cursor = 0
    const pieces = []
    sorted.forEach((item, idx) => {
        const shouldReveal =
            isAllSubmitted ||
            (revealMode === 'per-question' && revealedQuestionIds.includes(item.id))
        const safeStart = Math.max(0, Math.min(lineText.length, item.start))
        const safeEnd = Math.max(safeStart, Math.min(lineText.length, item.end))
        let s = Math.max(cursor, safeStart)
        let e = Math.max(s, safeEnd)
        if (s > cursor) {
            pieces.push(lineText.slice(cursor, s))
        } else if (s < cursor) {
            s = cursor
            e = Math.max(s, safeEnd)
        }
        if (shouldReveal) {
            pieces.push(
                <span
                    key={`reveal-${item.id}-${idx}`}
                    className='rounded border border-emerald-300 bg-emerald-400/35 px-1 font-bold text-emerald-100'
                >
                    {item.answer || '答案'}
                </span>
            )
        } else {
            pieces.push(
                <span
                    key={`blank-${item.id}-${idx}`}
                    className='rounded border border-yellow-300 bg-yellow-300/20 px-1 font-semibold text-yellow-100'
                >
                    ____({item.blankIndex})____
                </span>
            )
        }
        cursor = Math.max(cursor, e)
    })
    if (cursor < lineText.length) {
        pieces.push(lineText.slice(cursor))
    }
    return <>{pieces}</>
}

export default QuizPage
