'use client'

const CHOICE_LABELS = ['A', 'B', 'C', 'D']

export default function QuestionEditor({
    question,
    index,
    quizType,
    onChange,
    onLocateEvidence,
}) {
    const q = question || {}
    const number = index + 1
    const prefix =
        quizType === 'cloze' && q.blankIndex != null
            ? `第 ${q.blankIndex} 空`
            : `第 ${number} 题`

    const handleChoiceChange = (i, val) => {
        const newChoices = [...(q.choices || ['', '', '', ''])]
        newChoices[i] = val
        onChange({ ...q, choices: newChoices })
    }

    return (
        <div className='rounded border border-white/15 bg-black/15 p-4 mb-3'>
            <div className='mb-2 flex items-center justify-between gap-2'>
                <span className='text-xs font-semibold text-emerald-300'>{prefix}</span>
                {q.sourceEvidence && (
                    <button
                        type='button'
                        onClick={() => onLocateEvidence?.(q)}
                        className='rounded border border-cyan-400/40 px-2 py-0.5 text-xs text-cyan-200 hover:bg-cyan-400/10'
                    >
                        定位依据
                    </button>
                )}
            </div>

            {/* Question stem */}
            <div className='mb-3'>
                <label className='text-xs text-white/50 mb-1 block'>题干</label>
                <textarea
                    rows={2}
                    value={q.query || ''}
                    onChange={(e) => onChange({ ...q, query: e.target.value })}
                    className='w-full rounded border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:border-emerald-400/60 focus:outline-none resize-none'
                />
            </div>

            {/* Choices */}
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3'>
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className='flex items-center gap-2'>
                        <span className='text-xs text-white/50 w-4 shrink-0'>{CHOICE_LABELS[i]}.</span>
                        <input
                            type='text'
                            value={q.choices?.[i] || ''}
                            onChange={(e) => handleChoiceChange(i, e.target.value)}
                            className='flex-1 rounded border border-white/20 bg-white/5 px-2 py-1 text-sm text-white placeholder-white/30 focus:border-emerald-400/60 focus:outline-none'
                        />
                    </div>
                ))}
            </div>

            {/* Answer select */}
            <div className='flex flex-wrap items-center gap-4 mb-3'>
                <div className='flex items-center gap-2'>
                    <label className='text-xs text-white/50'>答案</label>
                    <select
                        value={q.answer ?? 0}
                        onChange={(e) =>
                            onChange({ ...q, answer: Number(e.target.value) })
                        }
                        className='rounded border border-white/20 bg-[#1a2236] px-2 py-1 text-sm text-white focus:outline-none'
                    >
                        {[0, 1, 2, 3].map((i) => (
                            <option key={i} value={i}>
                                {CHOICE_LABELS[i]}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Explanation */}
            <div>
                <label className='text-xs text-white/50 mb-1 block'>中文解析</label>
                <textarea
                    rows={2}
                    value={q.explanationZh || ''}
                    onChange={(e) => onChange({ ...q, explanationZh: e.target.value })}
                    className='w-full rounded border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:border-emerald-400/60 focus:outline-none resize-none'
                    placeholder='中文解析（选填，导出教师版时显示）'
                />
            </div>
        </div>
    )
}
