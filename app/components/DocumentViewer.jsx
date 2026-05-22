'use client'

import { useEffect } from 'react'

export function groupQuestionsByType(questions) {
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

function highlightLineText(
    lineText,
    sourcePosition,
    isActiveLine,
    quizType,
    originalLineText
) {
    if (!isActiveLine) return lineText
    if (quizType === 'cloze') return lineText
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

function getRenderedLine({
    lineText,
    pageNumber,
    lineNumber,
    clozeQuestions,
    revealMode,
    revealedQuestionIds,
    isAllSubmitted,
    quizType,
}) {
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

    const byBlank = [...relatedQuestions].sort((a, b) => a.blankIndex - b.blankIndex)
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

export default function DocumentViewer({
    parsedDocument,
    activeSourcePosition,
    activeQuestionMeta,
    clozeQuestions,
    revealMode = 'per-question',
    revealedQuestionIds = [],
    isAllSubmitted = false,
    quizType,
}) {
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
                    ? '完形：若坐标为「近似」或无法精确到词，左侧原文行会整体弱高亮并标出空位编号。'
                    : '若证据为「近似」定位，左侧对应行会整体弱高亮，便于在原文中自行对照。'}
            </p>
            <div className='max-h-[560px] space-y-6 overflow-auto pr-2'>
                {!parsedDocument?.pages?.length ? (
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
                                        activeSourcePosition.page === page.pageNumber &&
                                        line.lineNumber >= activeSourcePosition.lineStart &&
                                        line.lineNumber <= activeSourcePosition.lineEnd
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
                                                    ? `题号: ${activeQuestionMeta.questionNo} | 证据: ${activeQuestionMeta.sourceEvidence}`
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
