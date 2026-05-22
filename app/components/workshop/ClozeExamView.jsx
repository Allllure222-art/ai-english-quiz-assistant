'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

// ─── Blank element ──────────────────────────────────────────────────────────
// Rendered as: ___41___ (underline + bold number, matching exam paper style)
function BlankEl({ blankIndex, isActive, onBlankClick }) {
    return (
        <button
            id={`cloze-blank-${blankIndex}`}
            type='button'
            aria-label={`第${blankIndex}空`}
            onClick={() => onBlankClick(blankIndex)}
            className={`inline-block cursor-pointer border-b-[1.5px] font-bold leading-none
                mx-[2px] px-[6px] min-w-[2.8em] text-center align-baseline select-none
                transition-colors focus:outline-none
                ${isActive
                    ? 'border-blue-600 text-blue-700 bg-yellow-100'
                    : 'border-gray-700 text-gray-700 hover:bg-yellow-50 hover:border-blue-400'
                }`}
            style={{ fontFamily: 'inherit', fontSize: 'inherit' }}
        >
            {blankIndex}
        </button>
    )
}

// ─── Render one text line with blanks ───────────────────────────────────────
function renderLineWithBlanks(lineText, blanks, activeBlankIndex, onBlankClick) {
    if (!blanks || blanks.length === 0) return lineText

    // Separate exact-positioned blanks from approximate ones
    const exact = blanks
        .filter(b => b.precision === 'exact' && b.charEnd > b.charStart && b.charStart >= 0)
        .sort((a, b) => a.charStart - b.charStart)
    const approx = blanks.filter(
        b => !(b.precision === 'exact' && b.charEnd > b.charStart && b.charStart >= 0)
    )

    const pieces = []
    let cursor = 0

    for (const blank of exact) {
        const s = Math.max(cursor, blank.charStart)
        const e = Math.max(s, Math.min(lineText.length, blank.charEnd))
        if (s > cursor) pieces.push(lineText.slice(cursor, s))
        pieces.push(
            <BlankEl
                key={`b${blank.blankIndex}`}
                blankIndex={blank.blankIndex}
                isActive={blank.blankIndex === activeBlankIndex}
                onBlankClick={onBlankClick}
            />
        )
        cursor = e
    }
    if (cursor < lineText.length) pieces.push(lineText.slice(cursor))

    // Approximate blanks appended inline after the line
    for (const blank of approx) {
        pieces.push(
            <BlankEl
                key={`b${blank.blankIndex}`}
                blankIndex={blank.blankIndex}
                isActive={blank.blankIndex === activeBlankIndex}
                onBlankClick={onBlankClick}
            />
        )
    }

    return pieces.map((p, i) =>
        typeof p === 'string' ? <span key={i}>{p}</span> : p
    )
}

// ─── Group parsed lines into paragraphs ────────────────────────────────────
function buildParagraphs(processedLines) {
    const paragraphs = []
    let current = []
    for (const line of processedLines) {
        if (line.isEmpty) {
            if (current.length > 0) { paragraphs.push(current); current = [] }
        } else {
            current.push(line)
        }
    }
    if (current.length > 0) paragraphs.push(current)
    return paragraphs
}

// ─── Build processed lines from parsedDocument + questions ─────────────────
function buildProcessedLines(parsedDocument, questions) {
    if (!parsedDocument?.pages?.length) return null

    // Map: "page-lineStart" → list of blanks on that line
    const blankMap = {}
    for (const q of questions) {
        const sp = q.sourcePosition
        if (!sp) continue
        const key = `${sp.page}-${sp.lineStart}`
        if (!blankMap[key]) blankMap[key] = []
        blankMap[key].push({
            blankIndex: q.blankIndex,
            charStart: sp.charStart ?? 0,
            charEnd: sp.charEnd ?? 0,
            precision: sp.precision || 'approximate',
        })
    }

    const lines = []
    for (const page of parsedDocument.pages) {
        for (const line of page.lines) {
            const key = `${page.pageNumber}-${line.lineNumber}`
            lines.push({
                text: line.text,
                blanks: blankMap[key] || [],
                isEmpty: !line.text?.trim(),
            })
        }
    }
    return lines
}

// ─── Options panel (right side) ────────────────────────────────────────────
const CHOICE_LABELS = ['A', 'B', 'C', 'D']

function OptionsPanel({ question, total, onPrev, onNext, isTeacher, onQuestionChange }) {
    if (!question) {
        return (
            <div className='flex flex-1 items-center justify-center text-gray-400 text-sm p-6 text-center'>
                <p>点击原文中的序号<br />查看对应选项</p>
            </div>
        )
    }

    const handleChoiceChange = (i, val) => {
        if (!onQuestionChange) return
        const newChoices = [...(question.choices || ['', '', '', ''])]
        newChoices[i] = val
        onQuestionChange({ ...question, choices: newChoices })
    }

    return (
        <div className='flex flex-col h-full overflow-auto' style={{ fontFamily: '"Times New Roman","SimSun",serif' }}>
            {/* Nav bar */}
            <div className='flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50 shrink-0'>
                <span className='text-sm font-semibold text-gray-700'>
                    第 {question.blankIndex} 空 &nbsp;/&nbsp; 共 {total} 空
                </span>
                <div className='flex gap-1'>
                    <button
                        type='button'
                        onClick={onPrev}
                        disabled={question.blankIndex <= 1}
                        className='rounded px-2 py-0.5 text-xs text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed'
                    >
                        ‹ 上题
                    </button>
                    <button
                        type='button'
                        onClick={onNext}
                        disabled={question.blankIndex >= total}
                        className='rounded px-2 py-0.5 text-xs text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed'
                    >
                        下题 ›
                    </button>
                </div>
            </div>

            {/* Context sentence */}
            <div className='px-4 pt-3 pb-2 border-b border-gray-100'>
                <p className='text-[13px] text-gray-600 leading-relaxed italic'>
                    {question.query || '（无题干）'}
                </p>
            </div>

            {/* Choices */}
            <div className='px-4 py-3 space-y-1.5 flex-1'>
                {(question.choices || []).map((choice, i) => {
                    const isCorrect = isTeacher && i === question.answer
                    return (
                        <div
                            key={i}
                            className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm
                                ${isCorrect ? 'bg-green-50 border border-green-300' : 'border border-transparent'}`}
                        >
                            <span className={`w-5 shrink-0 font-semibold ${isCorrect ? 'text-green-700' : 'text-gray-500'}`}>
                                {CHOICE_LABELS[i]}.
                            </span>
                            {isTeacher ? (
                                <input
                                    type='text'
                                    value={choice}
                                    onChange={e => handleChoiceChange(i, e.target.value)}
                                    className={`flex-1 bg-transparent text-sm focus:outline-none
                                        ${isCorrect ? 'text-green-800 font-semibold' : 'text-gray-800'}`}
                                />
                            ) : (
                                <span className={isCorrect ? 'text-green-800 font-semibold' : 'text-gray-800'}>
                                    {choice}
                                </span>
                            )}
                            {isCorrect && <span className='ml-auto text-green-500 text-xs'>✓</span>}
                        </div>
                    )
                })}
            </div>

            {/* Answer selector (teacher only) */}
            {isTeacher && (
                <div className='px-4 py-2 border-t border-gray-100 flex items-center gap-3'>
                    <span className='text-xs text-gray-500'>答案</span>
                    <div className='flex gap-1'>
                        {[0, 1, 2, 3].map(i => (
                            <button
                                key={i}
                                type='button'
                                onClick={() => onQuestionChange?.({ ...question, answer: i })}
                                className={`w-7 h-7 rounded text-xs font-semibold border transition-colors
                                    ${question.answer === i
                                        ? 'bg-green-600 text-white border-green-600'
                                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                {CHOICE_LABELS[i]}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Explanation (teacher only) */}
            {isTeacher && (
                <div className='px-4 pb-3 border-t border-gray-100 pt-2'>
                    <p className='text-xs text-gray-400 mb-1'>解析</p>
                    <textarea
                        rows={3}
                        value={question.explanationZh || ''}
                        onChange={e => onQuestionChange?.({ ...question, explanationZh: e.target.value })}
                        className='w-full text-xs text-gray-700 leading-relaxed border border-gray-200 rounded px-2 py-1 resize-none focus:outline-none focus:border-gray-400'
                        placeholder='中文解析（教师版导出时显示）'
                    />
                </div>
            )}
        </div>
    )
}

// ─── Main ClozeExamView ─────────────────────────────────────────────────────
export default function ClozeExamView({ bundle, isTeacher = true, onQuestionChange }) {
    const questions = (bundle?.questions || []).filter(q => q.questionType === 'cloze')
    const total = questions.length

    const firstBlank = questions[0]?.blankIndex ?? 1
    const [activeBlankIndex, setActiveBlankIndex] = useState(firstBlank)

    // Reset when bundle changes (e.g. regenerated)
    useEffect(() => {
        setActiveBlankIndex(questions[0]?.blankIndex ?? 1)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bundle?.meta?.createdAt])

    const activeQuestion = questions.find(q => q.blankIndex === activeBlankIndex) || questions[0]

    const handleBlankClick = useCallback(idx => {
        setActiveBlankIndex(idx)
    }, [])

    const handlePrev = useCallback(() => {
        const i = questions.findIndex(q => q.blankIndex === activeBlankIndex)
        if (i > 0) setActiveBlankIndex(questions[i - 1].blankIndex)
    }, [questions, activeBlankIndex])

    const handleNext = useCallback(() => {
        const i = questions.findIndex(q => q.blankIndex === activeBlankIndex)
        if (i < questions.length - 1) setActiveBlankIndex(questions[i + 1].blankIndex)
    }, [questions, activeBlankIndex])

    // Scroll active blank into view
    useEffect(() => {
        const el = document.getElementById(`cloze-blank-${activeBlankIndex}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, [activeBlankIndex])

    const parsedDocument = bundle?.passage?.parsedDocument
    const plainText = bundle?.passage?.plainText || ''
    const processedLines = parsedDocument ? buildProcessedLines(parsedDocument, questions) : null
    const paragraphs = processedLines ? buildParagraphs(processedLines) : null

    const meta = bundle?.meta || {}

    return (
        <div
            className='flex rounded-lg overflow-hidden border border-gray-300 shadow-md bg-white'
            style={{ minHeight: '600px', fontFamily: '"Times New Roman","SimSun",serif' }}
        >
            {/* ── Left: Exam passage ───────────────────────────────────────── */}
            <div className='flex-1 bg-white overflow-auto p-6 border-r border-gray-200'>
                {/* Paper header */}
                <div className='mb-4 pb-3 border-b border-gray-400'>
                    <h2 className='text-center font-bold text-gray-900 text-base mb-1 tracking-wide'>
                        {meta.title || '完形填空'}
                    </h2>
                    {meta.subtitle && (
                        <p className='text-center text-sm text-gray-600'>{meta.subtitle}</p>
                    )}
                    <div className='mt-2 flex gap-6 text-xs text-gray-500 justify-end'>
                        <span>
                            姓名：
                            <span className='inline-block w-24 border-b border-gray-500'>&nbsp;</span>
                        </span>
                        <span>
                            班级：
                            <span className='inline-block w-24 border-b border-gray-500'>&nbsp;</span>
                        </span>
                    </div>
                </div>

                {/* Section heading */}
                <p className='mb-4 text-sm font-semibold text-gray-800'>
                    第一节 &nbsp;完形填空（共&nbsp;{total}&nbsp;题）
                </p>

                {/* Passage */}
                <div
                    className='text-[13.5px] leading-8 text-gray-900 text-justify'
                    style={{ fontFamily: '"Times New Roman","SimSun",serif' }}
                >
                    {paragraphs ? (
                        paragraphs.map((para, pi) => (
                            <p key={pi} className='mb-4' style={{ textIndent: '2em' }}>
                                {para.map((line, li) => (
                                    <span key={li}>
                                        {renderLineWithBlanks(
                                            line.text,
                                            line.blanks,
                                            activeBlankIndex,
                                            handleBlankClick
                                        )}
                                        {li < para.length - 1 ? ' ' : ''}
                                    </span>
                                ))}
                            </p>
                        ))
                    ) : plainText ? (
                        // Fallback: plain text with approximate blank markers appended
                        <>
                            <p className='mb-4 whitespace-pre-wrap' style={{ textIndent: '2em' }}>
                                {plainText}
                            </p>
                            {questions.length > 0 && (
                                <div className='mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500'>
                                    <span>空格位置（近似）：</span>
                                    {questions.map(q => (
                                        <BlankEl
                                            key={q.blankIndex}
                                            blankIndex={q.blankIndex}
                                            isActive={q.blankIndex === activeBlankIndex}
                                            onBlankClick={handleBlankClick}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <p className='text-gray-400 text-sm'>（原文不可用）</p>
                    )}
                </div>
            </div>

            {/* ── Right: Options panel ─────────────────────────────────────── */}
            <div className='w-72 bg-white flex flex-col border-l border-gray-200 shrink-0'>
                <OptionsPanel
                    question={activeQuestion}
                    total={total}
                    onPrev={handlePrev}
                    onNext={handleNext}
                    isTeacher={isTeacher}
                    onQuestionChange={onQuestionChange}
                />
            </div>
        </div>
    )
}
