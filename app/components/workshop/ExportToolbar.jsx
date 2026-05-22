'use client'

import { useState } from 'react'

async function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
}

export default function ExportToolbar({ bundle, disabled, onIncludeEvidenceChange }) {
    const [loading, setLoading] = useState('')
    const [error, setError] = useState('')

    const includeEvidence = bundle?.exportPrefs?.includeEvidenceInTeacher ?? true
    const title = bundle?.meta?.title || '练习'

    const download = async (variant) => {
        if (!bundle || loading) return
        setLoading(variant)
        setError('')
        try {
            const res = await fetch('/api/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    variant,
                    bundle,
                    includeEvidence,
                }),
            })

            if (!res.ok) {
                const json = await res.json().catch(() => ({}))
                setError(json.message || '导出失败，请稍后重试。')
                return
            }

            if (variant === 'pdf') {
                // Server returns HTML; open in new window for browser print-to-PDF
                const html = await res.text()
                const win = window.open('', '_blank')
                if (win) {
                    win.document.write(html)
                    win.document.close()
                } else {
                    setError('浏览器阻止了弹出窗口，请允许后重试，或用 Word 另存为 PDF。')
                }
                return
            }

            const blob = await res.blob()
            const suffix = variant === 'teacher' ? '教师版' : '学生版'
            const ext = 'docx'
            triggerDownload(blob, `${title}-${suffix}.${ext}`)
        } catch {
            setError('网络错误，请稍后重试。')
        } finally {
            setLoading('')
        }
    }

    const btnBase =
        'rounded border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50'

    return (
        <div className='rounded border border-white/15 bg-black/20 p-4'>
            <h3 className='text-sm font-semibold text-emerald-200 mb-3'>导出</h3>

            <label className='flex items-center gap-2 mb-4 cursor-pointer select-none'>
                <input
                    type='checkbox'
                    checked={includeEvidence}
                    onChange={(e) => onIncludeEvidenceChange?.(e.target.checked)}
                    className='h-4 w-4 accent-emerald-400'
                />
                <span className='text-sm text-white/80'>教师版包含原文依据</span>
            </label>

            <div className='flex flex-wrap gap-2'>
                <button
                    type='button'
                    className={`${btnBase} border-cyan-400/50 text-cyan-200 hover:bg-cyan-400/10`}
                    disabled={disabled || !!loading}
                    onClick={() => download('student')}
                >
                    {loading === 'student' ? '导出中…' : '学生版 Word'}
                </button>
                <button
                    type='button'
                    className={`${btnBase} border-emerald-400/50 text-emerald-200 hover:bg-emerald-400/10`}
                    disabled={disabled || !!loading}
                    onClick={() => download('teacher')}
                >
                    {loading === 'teacher' ? '导出中…' : '教师版 Word'}
                </button>
                <button
                    type='button'
                    className={`${btnBase} border-amber-400/50 text-amber-200 hover:bg-amber-400/10`}
                    disabled={disabled || !!loading}
                    onClick={() => download('pdf')}
                    title='在浏览器新窗口打开后，按 Ctrl+P 打印为 PDF'
                >
                    {loading === 'pdf' ? '生成中…' : '打印为 PDF'}
                </button>
            </div>

            <p className='mt-2 text-xs text-white/40'>
                PDF：在弹出的窗口中选择「打印」→「另存为 PDF」即可。导出不消耗出题次数。
            </p>

            {error && (
                <p className='mt-2 rounded border border-red-400/50 bg-red-500/10 p-2 text-xs text-red-300'>
                    {error}
                </p>
            )}
        </div>
    )
}
