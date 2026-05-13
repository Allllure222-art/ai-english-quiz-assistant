import Facts from './Facts'

import { Bars } from 'react-loader-spinner'

/**
 * 出题等待页（非流式）：分阶段文案 + 已等待秒数 + 可选取消。
 */
const LoadingScreen = ({
    phaseTitle = '正在生成练习题…',
    phaseHint = '',
    elapsedSeconds = 0,
    onCancel,
}) => {
    return (
        <>
            <div className='pointer-events-none text-white/10 text-xs text-justify'>
                <div className='fixed opacity-30' aria-hidden />
            </div>
            <div className='grid min-h-[70dvh] place-items-center px-4 pb-24 pt-16'>
                <div className='flex w-full max-w-lg flex-col items-center'>
                    <div className='flex flex-wrap items-center justify-center gap-3 sm:gap-4'>
                        <Bars width='48' height='48' color='#6ee7b7' aria-hidden />
                        <div className='min-w-0 text-center'>
                            <p className='animate-pulse text-xl font-bold text-emerald-300 sm:text-2xl'>
                                {phaseTitle}
                            </p>
                            {phaseHint ? (
                                <p className='mt-2 text-xs leading-relaxed text-emerald-200/80 sm:text-sm'>
                                    {phaseHint}
                                </p>
                            ) : null}
                            <p className='mt-2 text-xs text-white/50'>
                                已等待 {elapsedSeconds} 秒 · 生成完成前请勿关闭本页
                            </p>
                        </div>
                        <Bars width='48' height='48' color='#6ee7b7' aria-hidden />
                    </div>
                    {typeof onCancel === 'function' ? (
                        <button
                            type='button'
                            className='mt-6 rounded border border-white/30 px-4 py-2 text-sm text-white/80 hover:bg-white/10'
                            onClick={onCancel}
                        >
                            取消本次出题
                        </button>
                    ) : null}
                    <div className='mt-8 w-full'>
                        <Facts />
                    </div>
                </div>
            </div>
        </>
    )
}
export default LoadingScreen
