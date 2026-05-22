'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

import { motion, useSpring } from 'framer-motion'

import LoadingScreen from '../components/LoadingScreen'
import Question from '../components/Question'
import DocumentViewer, { groupQuestionsByType } from '../components/DocumentViewer'
import { buildPhaseCopy, mapQuizFetchFailure, QUIZ_FETCH_TIMEOUT_MS } from '../../lib/quizGenerationClient'

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

    const workshopHref = `/workshop?${params.toString()}`

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
                    {/* Workshop banner */}
                    <div className='mb-4 rounded border border-cyan-400/30 bg-cyan-500/10 p-3 text-sm text-cyan-100'>
                        教师备课请使用{' '}
                        <Link href={workshopHref} className='font-medium underline hover:text-white'>
                            备课工作台
                        </Link>{' '}
                        审阅并导出学生版 / 教师版 Word 与 PDF。
                    </div>
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

export default QuizPage
