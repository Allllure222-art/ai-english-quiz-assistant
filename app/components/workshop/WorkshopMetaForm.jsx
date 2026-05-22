'use client'

/**
 * variant='dark'  — used in the dark reading-workshop layout (default)
 * variant='light' — used in the cloze exam-paper layout (white background)
 */
export default function WorkshopMetaForm({ meta, onChange, variant = 'dark' }) {
    const isLight = variant === 'light'
    return (
        <div className={isLight
            ? 'mb-2'
            : 'rounded border border-white/15 bg-black/20 p-4 mb-4'
        }>
            <h3 className={`text-sm font-semibold mb-3 ${isLight ? 'text-gray-700' : 'text-emerald-200'}`}>
                卷面信息
            </h3>
            <div className='flex flex-col gap-3'>
                <div className='flex flex-col gap-1'>
                    <label className={`text-xs ${isLight ? 'text-gray-500' : 'text-white/60'}`}>标题</label>
                    <input
                        type='text'
                        value={meta?.title || ''}
                        onChange={(e) => onChange({ ...meta, title: e.target.value })}
                        className={isLight
                            ? 'rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none'
                            : 'rounded border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:border-emerald-400/60 focus:outline-none'
                        }
                        placeholder='例：Unit 3 完形填空'
                    />
                </div>
                <div className='flex flex-col gap-1'>
                    <label className={`text-xs ${isLight ? 'text-gray-500' : 'text-white/60'}`}>副标题（可选）</label>
                    <input
                        type='text'
                        value={meta?.subtitle || ''}
                        onChange={(e) => onChange({ ...meta, subtitle: e.target.value })}
                        className={isLight
                            ? 'rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none'
                            : 'rounded border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:border-emerald-400/60 focus:outline-none'
                        }
                        placeholder='例：七年级下 / 满分 20 分'
                    />
                </div>
            </div>
        </div>
    )
}
