'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

import LoadingScreen from '../components/LoadingScreen'
import DocumentViewer from '../components/DocumentViewer'
import WorkshopMetaForm from '../components/workshop/WorkshopMetaForm'
import QuestionEditor from '../components/workshop/QuestionEditor'
import ExportToolbar from '../components/workshop/ExportToolbar'

import { useQuizGeneration } from '../hooks/useQuizGeneration'
import { buildPhaseCopy } from '../../lib/quizGenerationClient'
import {
    createWorkshopBundle,
    saveWorkshopBundle,
    loadWorkshopBundle,
} from '../../lib/workshopBundle'

const SAVE_DEBOUNCE_MS = 600

export default function WorkshopPage() {
    const params = useSearchParams()
    const router = useRouter()

    const quizType = params.get('quizType') || 'reading'
    const difficulty = params.get('difficulty') || 'beginner'
    const numQuestions = Number(params.get('numQuestions')) || 5
    const draftId = params.get('draftId')

    const searchParamStr = params.toString()

    const [bundle, setBundle] = useState(null)
    const [generationKey, setGenerationKey] = useState(0)
    const [activeSourcePosition, setActiveSourcePosition] = useState(null)
    const [activeQuestionMeta, setActiveQuestionMeta] = useState(null)
    const saveTimerRef = useRef(null)

    // ------------------------------------------------------------------
    // Check for cached bundle (avoids re-generating on refresh)
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!draftId) return
        const cached = loadWorkshopBundle(draftId)
        if (cached) setBundle(cached)
    }, [draftId])

    // ------------------------------------------------------------------
    // Quiz generation (only runs if no cached bundle)
    // ------------------------------------------------------------------
    const handleSuccess = useCallback(
        ({ questions, parsedDocument, articleMeta }) => {
            const newBundle = createWorkshopBundle({
                quizType,
                difficulty,
                numQuestions,
                parsedDocument,
                questions,
                articleMeta,
            })
            setBundle(newBundle)
            saveWorkshopBundle(draftId, newBundle)
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [quizType, difficulty, numQuestions, draftId]
    )

    const skipGeneration = !!bundle
    const { isLoading, errorDetail, elapsedSeconds, cancel } = useQuizGeneration({
        quizType,
        difficulty,
        numQuestions,
        draftId: skipGeneration ? null : draftId,
        generationKey,
        onSuccess: handleSuccess,
    })

    // ------------------------------------------------------------------
    // Debounced save on edit
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!bundle || !draftId) return
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => {
            saveWorkshopBundle(draftId, bundle)
        }, SAVE_DEBOUNCE_MS)
        return () => clearTimeout(saveTimerRef.current)
    }, [bundle, draftId])

    // ------------------------------------------------------------------
    // Handlers
    // ------------------------------------------------------------------
    const handleMetaChange = (newMeta) => {
        setBundle((prev) => ({ ...prev, meta: newMeta }))
    }

    const handleQuestionChange = (index, newQ) => {
        setBundle((prev) => {
            const questions = [...(prev.questions || [])]
            questions[index] = newQ
            return { ...prev, questions }
        })
    }

    const handleIncludeEvidenceChange = (checked) => {
        setBundle((prev) => ({
            ...prev,
            exportPrefs: { ...prev.exportPrefs, includeEvidenceInTeacher: checked },
        }))
    }

    const handleRegenerate = () => {
        setBundle(null)
        if (draftId) {
            try {
                window.sessionStorage.removeItem(`workshop:${draftId}`)
            } catch {}
        }
        setActiveSourcePosition(null)
        setActiveQuestionMeta(null)
        setGenerationKey((k) => k + 1)
    }

    const handleLocateEvidence = (question) => {
        setActiveSourcePosition(question.sourcePosition || null)
        setActiveQuestionMeta({
            questionNo: question._globalIndex + 1,
            questionType: question.questionType,
            sourceEvidence: question.sourceEvidence,
            explanationZh: question.explanationZh || '',
        })
    }

    // ------------------------------------------------------------------
    // Guard: no draftId
    // ------------------------------------------------------------------
    if (!draftId) {
        return (
            <div className='mx-auto max-w-lg px-4 pt-20 text-center text-white/80'>
                <p>链接参数不完整，请从首页重新进入。</p>
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

    // ------------------------------------------------------------------
    // Loading state
    // ------------------------------------------------------------------
    if (isLoading && !bundle) {
        const phase = buildPhaseCopy(elapsedSeconds)
        return (
            <LoadingScreen
                phaseTitle={phase.title}
                phaseHint={phase.hint}
                elapsedSeconds={elapsedSeconds}
                onCancel={cancel}
            />
        )
    }

    // ------------------------------------------------------------------
    // Error state
    // ------------------------------------------------------------------
    if (errorDetail && !bundle) {
        return (
            <div className='mx-auto max-w-lg px-4 pt-16'>
                <div className='rounded border border-red-400/60 bg-red-500/10 p-5'>
                    <p className='font-semibold text-red-200'>{errorDetail.headline}</p>
                    <p className='mt-1 text-sm text-red-300/80'>{errorDetail.body}</p>
                    {errorDetail.code && (
                        <p className='mt-2 text-xs text-white/40'>
                            错误代码：{errorDetail.code}
                        </p>
                    )}
                    <div className='mt-4 flex flex-wrap gap-2'>
                        <button
                            type='button'
                            className='rounded border border-emerald-300/70 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-300/10 disabled:opacity-40'
                            disabled={errorDetail.code === 'MISSING_DOCUMENT'}
                            onClick={handleRegenerate}
                        >
                            使用同一材料重新生成
                        </button>
                        <button
                            type='button'
                            className='rounded border border-white/30 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10'
                            onClick={() => router.push('/')}
                        >
                            返回首页换材料
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ------------------------------------------------------------------
    // Empty bundle (shouldn't usually happen)
    // ------------------------------------------------------------------
    if (!bundle) {
        const phase = buildPhaseCopy(elapsedSeconds)
        return (
            <LoadingScreen
                phaseTitle={phase.title}
                phaseHint={phase.hint}
                elapsedSeconds={elapsedSeconds}
                onCancel={cancel}
            />
        )
    }

    // ------------------------------------------------------------------
    // Main workshop UI
    // ------------------------------------------------------------------
    const clozeQuestions = (bundle.questions || [])
        .map((q, i) => ({ ...q, _globalIndex: i }))
        .filter((q) => q.questionType === 'cloze')

    const allIds = (bundle.questions || []).map((_, i) => i)

    return (
        <div className='mx-auto max-w-[1400px] pb-12 pt-4'>
            {/* Page header */}
            <div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
                <div>
                    <h1 className='text-xl font-bold text-emerald-200'>备课工作台</h1>
                    {bundle.articleMeta && (
                        <p className='mt-0.5 text-xs text-white/50'>
                            来源：{bundle.articleMeta.sourceName}
                            {bundle.articleMeta.sourceUrl && (
                                <>
                                    {' '}·{' '}
                                    <a
                                        href={bundle.articleMeta.sourceUrl}
                                        target='_blank'
                                        rel='noreferrer'
                                        className='text-cyan-200 hover:underline'
                                    >
                                        查看原文
                                    </a>
                                </>
                            )}
                        </p>
                    )}
                </div>
                <div className='flex flex-wrap gap-2'>
                    <Link
                        href={`/quiz?${searchParamStr}`}
                        className='rounded border border-white/30 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10'
                    >
                        在线预览 / 自练
                    </Link>
                    <button
                        type='button'
                        onClick={handleRegenerate}
                        disabled={isLoading}
                        className='rounded border border-amber-400/50 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-400/10 disabled:opacity-50'
                    >
                        重新生成
                    </button>
                    <Link
                        href='/'
                        className='rounded border border-white/20 px-3 py-1.5 text-xs text-white/50 hover:bg-white/10'
                    >
                        返回首页
                    </Link>
                </div>
            </div>

            <p className='mb-4 rounded border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/80'>
                修改题干后，建议重新核对原文依据。编辑内容已自动保存到本机（刷新不丢）。
            </p>

            {/* Two-column layout */}
            <div className='grid gap-6 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]'>
                {/* Left: Document viewer */}
                <aside className='self-start lg:sticky lg:top-4'>
                    {bundle.passage?.parsedDocument ? (
                        <DocumentViewer
                            parsedDocument={bundle.passage.parsedDocument}
                            activeSourcePosition={activeSourcePosition}
                            activeQuestionMeta={activeQuestionMeta}
                            clozeQuestions={clozeQuestions}
                            revealMode='per-question'
                            revealedQuestionIds={allIds}
                            isAllSubmitted={true}
                            quizType={quizType}
                        />
                    ) : (
                        <div className='rounded border border-white/15 bg-black/20 p-4 text-sm text-white/50'>
                            <p>原文定位不可用（文本材料不含行号信息）。</p>
                            {bundle.passage?.plainText && (
                                <div className='mt-3 max-h-[400px] overflow-auto whitespace-pre-wrap text-xs leading-6 text-white/70'>
                                    {bundle.passage.plainText}
                                </div>
                            )}
                        </div>
                    )}
                </aside>

                {/* Right: Editor */}
                <div>
                    {/* Meta form */}
                    <WorkshopMetaForm
                        meta={bundle.meta}
                        onChange={handleMetaChange}
                    />

                    {/* Questions */}
                    <h3 className='mb-2 text-sm font-semibold text-white/70'>
                        题目（共 {bundle.questions?.length || 0} 题）
                    </h3>
                    {(bundle.questions || []).map((q, i) => (
                        <QuestionEditor
                            key={i}
                            question={{ ...q, _globalIndex: i }}
                            index={i}
                            quizType={quizType}
                            onChange={(newQ) => handleQuestionChange(i, newQ)}
                            onLocateEvidence={handleLocateEvidence}
                        />
                    ))}

                    {/* Export toolbar */}
                    <div className='mt-4'>
                        <ExportToolbar
                            bundle={bundle}
                            disabled={!bundle?.questions?.length}
                            onIncludeEvidenceChange={handleIncludeEvidenceChange}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
