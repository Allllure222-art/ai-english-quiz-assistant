'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

import LoadingScreen from '../components/LoadingScreen'
import DocumentViewer from '../components/DocumentViewer'
import WorkshopMetaForm from '../components/workshop/WorkshopMetaForm'
import QuestionEditor from '../components/workshop/QuestionEditor'
import ExportToolbar from '../components/workshop/ExportToolbar'
import ClozeExamView from '../components/workshop/ClozeExamView'

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
    const isCloze = quizType === 'cloze'

    const searchParamStr = params.toString()

    const [bundle, setBundle] = useState(null)
    const [generationKey, setGenerationKey] = useState(0)
    const [activeSourcePosition, setActiveSourcePosition] = useState(null)
    const [activeQuestionMeta, setActiveQuestionMeta] = useState(null)
    const [showEditPanel, setShowEditPanel] = useState(false)
    const saveTimerRef = useRef(null)

    // ------------------------------------------------------------------
    // Load cached bundle
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!draftId) return
        const cached = loadWorkshopBundle(draftId)
        if (cached) setBundle(cached)
    }, [draftId])

    // ------------------------------------------------------------------
    // Quiz generation
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

    // For ClozeExamView: question change by blankIndex
    const handleClozeQuestionChange = useCallback((updatedQ) => {
        setBundle((prev) => {
            const questions = (prev.questions || []).map(q =>
                q.blankIndex === updatedQ.blankIndex ? updatedQ : q
            )
            return { ...prev, questions }
        })
    }, [])

    const handleIncludeEvidenceChange = (checked) => {
        setBundle((prev) => ({
            ...prev,
            exportPrefs: { ...prev.exportPrefs, includeEvidenceInTeacher: checked },
        }))
    }

    const handleRegenerate = () => {
        setBundle(null)
        if (draftId) {
            try { window.sessionStorage.removeItem(`workshop:${draftId}`) } catch {}
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
    // Guards
    // ------------------------------------------------------------------
    if (!draftId) {
        return (
            <div className='mx-auto max-w-lg px-4 pt-20 text-center text-white/80'>
                <p>链接参数不完整，请从首页重新进入。</p>
                <button type='button' className='q-button !mt-6' onClick={() => router.push('/')}>
                    返回首页
                </button>
            </div>
        )
    }

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

    if (errorDetail && !bundle) {
        return (
            <div className='mx-auto max-w-lg px-4 pt-16'>
                <div className='rounded border border-red-400/60 bg-red-500/10 p-5'>
                    <p className='font-semibold text-red-200'>{errorDetail.headline}</p>
                    <p className='mt-1 text-sm text-red-300/80'>{errorDetail.body}</p>
                    {errorDetail.code && (
                        <p className='mt-2 text-xs text-white/40'>错误代码：{errorDetail.code}</p>
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
    // ── CLOZE: Exam paper layout ────────────────────────────────────────
    // ------------------------------------------------------------------
    if (isCloze) {
        return (
            // Light gray background — simulates "print preview" environment
            <div className='min-h-screen bg-gray-100 pb-12'>
                {/* Top bar */}
                <div className='bg-white border-b border-gray-200 shadow-sm px-4 py-2 flex flex-wrap items-center gap-2 justify-between'>
                    <div className='flex items-center gap-2'>
                        <span className='text-sm font-semibold text-gray-700'>备课工作台</span>
                        <span className='text-gray-300'>|</span>
                        <span className='text-xs text-gray-500'>完形填空 · 预览及编辑</span>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        <Link
                            href={`/quiz?${searchParamStr}`}
                            className='rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50'
                        >
                            在线练习
                        </Link>
                        <button
                            type='button'
                            onClick={handleRegenerate}
                            disabled={isLoading}
                            className='rounded border border-amber-400 px-3 py-1 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-50'
                        >
                            重新生成
                        </button>
                        <button
                            type='button'
                            onClick={() => setShowEditPanel(v => !v)}
                            className={`rounded border px-3 py-1 text-xs transition-colors ${
                                showEditPanel
                                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {showEditPanel ? '▲ 收起编辑' : '✎ 编辑题目'}
                        </button>
                        <Link
                            href='/'
                            className='rounded border border-gray-200 px-3 py-1 text-xs text-gray-400 hover:bg-gray-50'
                        >
                            返回首页
                        </Link>
                    </div>
                </div>

                <div className='mx-auto max-w-[1200px] px-4 pt-4 space-y-4'>
                    {/* Auto-save tip */}
                    <p className='text-xs text-gray-400'>
                        编辑内容自动保存到本机，刷新不丢失。点击原文中序号可切换选项。
                    </p>

                    {/* Meta form (title / subtitle) */}
                    <div className='bg-white border border-gray-200 rounded-lg p-4 shadow-sm'>
                        <WorkshopMetaForm meta={bundle.meta} onChange={handleMetaChange} />
                    </div>

                    {/* Exam paper view */}
                    <ClozeExamView
                        bundle={bundle}
                        isTeacher={true}
                        onQuestionChange={handleClozeQuestionChange}
                    />

                    {/* Export toolbar */}
                    <div className='bg-white border border-gray-200 rounded-lg shadow-sm p-4'>
                        <ExportToolbar
                            bundle={bundle}
                            disabled={!bundle?.questions?.length}
                            onIncludeEvidenceChange={handleIncludeEvidenceChange}
                        />
                    </div>

                    {/* Collapsible question editor */}
                    {showEditPanel && (
                        <div className='bg-white border border-gray-200 rounded-lg shadow-sm p-4'>
                            <h3 className='text-sm font-semibold text-gray-700 mb-3'>
                                题目详细编辑（共 {bundle.questions?.length} 空）
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
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // ------------------------------------------------------------------
    // ── READING: Original two-column layout ─────────────────────────────
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
                    <WorkshopMetaForm meta={bundle.meta} onChange={handleMetaChange} />
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
