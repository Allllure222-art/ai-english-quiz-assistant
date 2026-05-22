'use client'

export default function WorkshopMetaForm({ meta, onChange }) {
    return (
        <div className='rounded border border-white/15 bg-black/20 p-4 mb-4'>
            <h3 className='text-sm font-semibold text-emerald-200 mb-3'>卷面信息</h3>
            <div className='flex flex-col gap-3'>
                <div className='flex flex-col gap-1'>
                    <label className='text-xs text-white/60'>标题</label>
                    <input
                        type='text'
                        value={meta?.title || ''}
                        onChange={(e) => onChange({ ...meta, title: e.target.value })}
                        className='rounded border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:border-emerald-400/60 focus:outline-none'
                        placeholder='例：Unit 3 阅读理解'
                    />
                </div>
                <div className='flex flex-col gap-1'>
                    <label className='text-xs text-white/60'>副标题（可选）</label>
                    <input
                        type='text'
                        value={meta?.subtitle || ''}
                        onChange={(e) => onChange({ ...meta, subtitle: e.target.value })}
                        className='rounded border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:border-emerald-400/60 focus:outline-none'
                        placeholder='例：七年级下 / 满分 20 分'
                    />
                </div>
            </div>
        </div>
    )
}
