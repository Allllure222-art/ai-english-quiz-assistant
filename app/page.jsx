'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession, signIn, signOut } from 'next-auth/react'

import { difficultyLevels, quizTypes } from './constants/quizOptions'
import { READING_RESOURCE_LINKS } from './constants/readingResourceLinks'
import { FiGithub } from 'react-icons/fi'

const HomePage = () => {
    const router = useRouter()
    const { data: session, status } = useSession()

    const [quizType, setQuizType] = useState('reading')
    const [difficulty, setDifficulty] = useState('beginner')
    const [numQuestions, setNumQuestions] = useState('5')
    const [passage, setPassage] = useState('')
    const [selectedFile, setSelectedFile] = useState(null)
    const [isParsing, setIsParsing] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    const handleSubmit = (e) => {
        e.preventDefault()
        const submit = async () => {
            try {
                setIsParsing(true)
                setErrorMessage('')
                const formData = new FormData()
                if (selectedFile) {
                    formData.append('inputType', 'file')
                    formData.append('file', selectedFile)
                } else {
                    formData.append('inputType', 'text')
                    formData.append('text', passage)
                }

                const response = await fetch('/api/parse-document', {
                    method: 'POST',
                    body: formData,
                })
                const result = await response.json()
                if (!response.ok) {
                    throw new Error(result?.message || '文档解析失败，请重试。')
                }

                const draftId = Date.now().toString()
                window.sessionStorage.setItem(
                    `parsedDocument:${draftId}`,
                    JSON.stringify(result.parsedDocument)
                )
                router.push(
                    `/workshop?quizType=${quizType}&difficulty=${difficulty}&numQuestions=${numQuestions}&draftId=${draftId}`
                )
            } catch (error) {
                setErrorMessage(error?.message || '文档解析失败，请稍后重试。')
            } finally {
                setIsParsing(false)
            }
        }
        submit()
    }

    const getUserLabel = () => {
        if (!session?.user) return '游客'
        return session.user.name || session.user.email || '已登录用户'
    }

    return (
        <div className='flex min-h-[100dvh] flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 md:pt-4'>
            {/* 宽屏：左侧精选阅读外链 + 主表单；整体限宽避免两侧大片留白 */}
            <div className='mx-auto flex w-full max-w-6xl flex-1 xl:items-start xl:gap-6'>
                <aside className='hidden w-[268px] shrink-0 xl:block xl:sticky xl:top-24 xl:self-start'>
                    <div className='rounded border border-cyan-300/30 bg-black/25 p-3'>
                        <div className='mb-2 flex items-center justify-between gap-2'>
                            <h3 className='font-semibold text-cyan-200'>阅读材料</h3>
                            <Link
                                href='/reading-hub'
                                className='shrink-0 text-xs text-cyan-200 hover:underline'
                            >
                                更多说明
                            </Link>
                        </div>
                        <p className='mb-2 text-[11px] leading-relaxed text-white/55'>
                            打开网站后复制英文正文，回到本页粘贴或上传 PDF/DOCX 出题。
                        </p>
                        <div className='space-y-2'>
                            {READING_RESOURCE_LINKS.map((item) => (
                                <a
                                    key={item.id}
                                    href={item.url}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='block rounded border border-white/15 p-2 hover:bg-white/5'
                                >
                                    <p className='text-xs font-medium text-emerald-200/90'>
                                        {item.name}
                                    </p>
                                    <p className='mt-0.5 text-[11px] text-white/50'>
                                        {item.blurb}
                                    </p>
                                </a>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* 主内容：窄屏全宽，宽屏占剩余空间并居中 */}
                <div className='flex min-w-0 flex-1 flex-col items-center px-3 sm:px-4'>
                    <div className='w-full max-w-xl md:max-w-2xl'>
                        <h1 className='q-animate-gradient bg-gradient-to-r from-emerald-500 via-pink-400 to-blue-500 bg-clip-text text-center text-3xl font-bold leading-tight text-transparent sm:text-4xl md:text-5xl lg:text-6xl'>
                            AI 初中英语备课助手
                        </h1>
                        <p className='mt-2 text-center text-xs text-white/70 sm:text-sm md:mt-3 md:text-base'>
                            上传材料 → AI 出题 → 网页审阅编辑 → 导出学生版 / 教师版 Word 与 PDF
                        </p>

                        <form
                            onSubmit={handleSubmit}
                            className='mt-6 flex w-full flex-col gap-3 sm:mt-8 md:gap-4'
                        >
                            <div className='grid grid-cols-2 gap-x-4 gap-y-3 sm:gap-x-6 sm:gap-y-4'>
                                <div className='flex flex-col'>
                                    <label htmlFor='quizType' className='text-xs uppercase'>
                                        题型
                                    </label>
                                    <select
                                        id='quizType'
                                        value={quizType}
                                        onChange={(e) => {
                                            const nextType = e.target.value
                                            setQuizType(nextType)
                                            setNumQuestions(nextType === 'cloze' ? '20' : '5')
                                        }}
                                        name='quizType'
                                        className='quiz-select'
                                    >
                                        {quizTypes.map((item) => (
                                            <option key={item.value} value={item.value}>
                                                {item.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className='flex flex-col'>
                                    <label htmlFor='difficulty' className='text-xs uppercase'>
                                        难度
                                    </label>
                                    <select
                                        id='difficulty'
                                        name='difficulty'
                                        value={difficulty}
                                        onChange={(e) => setDifficulty(e.target.value)}
                                        className='quiz-select'
                                    >
                                        {difficultyLevels.map((item) => (
                                            <option key={item.value} value={item.value}>
                                                {item.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className='flex flex-col'>
                                    <label htmlFor='numQuestions' className='text-xs uppercase'>
                                        题量
                                    </label>
                                    <select
                                        id='numQuestions'
                                        name='numQuestions'
                                        value={numQuestions}
                                        onChange={(e) => setNumQuestions(e.target.value)}
                                        className='quiz-select'
                                    >
                                        {quizType === 'cloze' ? (
                                            <>
                                                <option value='10'>10</option>
                                                <option value='15'>15</option>
                                                <option value='20'>20</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value='4'>4</option>
                                                <option value='5'>5</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>

                            <div className='flex flex-col'>
                                <label htmlFor='passage' className='text-xs uppercase'>
                                    粘贴英文材料
                                </label>
                                <textarea
                                    id='passage'
                                    name='passage'
                                    rows={4}
                                    placeholder='可直接粘贴英文文章。若上传了 PDF/DOCX，将优先使用上传文件。'
                                    value={passage}
                                    onChange={(e) => setPassage(e.target.value)}
                                    className='quiz-select min-h-[5.5rem] bg-white/95 px-3 py-2 text-sm md:min-h-[7.5rem] md:text-[15px]'
                                />
                            </div>

                            <div className='flex flex-col'>
                                <label htmlFor='materialFile' className='text-xs uppercase'>
                                    上传文件（PDF / DOCX，最大 10MB）
                                </label>
                                <input
                                    id='materialFile'
                                    type='file'
                                    accept='.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                                    onChange={(e) =>
                                        setSelectedFile(e.target.files?.[0] || null)
                                    }
                                    className='text-sm text-white/80'
                                />
                                {selectedFile && (
                                    <p className='mt-1 text-xs text-emerald-300/80'>
                                        已选择：{selectedFile.name}
                                    </p>
                                )}
                            </div>

                            {errorMessage && (
                                <div className='rounded border border-red-400/60 bg-red-400/10 p-3 text-sm text-red-300'>
                                    {errorMessage}
                                </div>
                            )}

                            <div className='mt-1 flex items-center justify-between'>
                                <p className='text-xs text-white/70'>
                                    当前身份：{getUserLabel()}
                                </p>
                                {status !== 'loading' && (
                                    session ? (
                                        <button
                                            type='button'
                                            onClick={() => signOut()}
                                            className='rounded border border-white/40 px-3 py-1 text-xs hover:bg-white/10'
                                        >
                                            退出登录
                                        </button>
                                    ) : (
                                        <button
                                            type='button'
                                            onClick={() => signIn('github')}
                                            className='rounded border border-white/40 px-3 py-1 text-xs hover:bg-white/10'
                                        >
                                            GitHub 登录
                                        </button>
                                    )
                                )}
                            </div>

                            <div className='mx-auto mt-4 flex w-full flex-col items-center sm:mt-5'>
                                <button
                                    className='q-button !mt-0 disabled:opacity-60'
                                    type='submit'
                                    disabled={isParsing}
                                >
                                    {isParsing ? '正在解析并生成...' : '生成并进入备课台'}
                                </button>
                                <div className='mt-2 flex flex-col items-center gap-1 text-center sm:mt-3'>
                                    <Link
                                        href='/reading-hub'
                                        className='text-sm text-cyan-200 hover:underline'
                                    >
                                        去文章来源中心选文章 →
                                    </Link>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <footer className='mt-auto flex w-full shrink-0 justify-center px-3 pt-6 text-center sm:px-4 sm:pt-8'>
                <a
                    className='inline-flex items-center gap-2 px-2 pb-1 font-mono text-xs text-white/60 transition hover:text-emerald-300 sm:text-sm'
                    href='https://github.com/quentin-mckay/ai-quiz-generator'
                    target='_blank'
                    rel='noreferrer'
                >
                    <FiGithub size={16} className='shrink-0' aria-hidden />
                    <span>基于 Next.js / Tailwind / OpenAI 构建</span>
                </a>
            </footer>
        </div>
    )
}
export default HomePage
