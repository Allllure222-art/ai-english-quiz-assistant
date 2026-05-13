'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

export default function ReadingArticlePage() {
    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()

    const [article, setArticle] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        if (!params?.id) return
        const loadArticle = async () => {
            try {
                setIsLoading(true)
                setErrorMessage('')
                const response = await fetch(`/api/reading/articles/${params.id}`)
                const payload = await response.json()
                if (!response.ok) {
                    throw new Error(payload?.message || '文章加载失败，请稍后重试。')
                }
                setArticle(payload.article)
            } catch (error) {
                setErrorMessage(error.message || '文章加载失败，请稍后重试。')
            } finally {
                setIsLoading(false)
            }
        }
        loadArticle()
    }, [params?.id])

    useEffect(() => {
        const shouldAutoGenerate = searchParams.get('action') === 'quiz'
        const quizType = searchParams.get('quizType') || 'reading'
        if (shouldAutoGenerate && article && !isGenerating) {
            handleGenerateQuiz(quizType)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [article, searchParams])

    const handleGenerateQuiz = async (quizType) => {
        if (!article?.content) {
            setErrorMessage('文章正文不可用，请复制原文后粘贴到出题器。')
            return
        }

        try {
            setIsGenerating(true)
            setErrorMessage('')
            const formData = new FormData()
            formData.append('inputType', 'text')
            formData.append('text', article.content)

            const response = await fetch('/api/parse-document', {
                method: 'POST',
                body: formData,
            })
            const payload = await response.json()
            if (!response.ok) {
                throw new Error(payload?.message || '文章解析失败，请稍后重试。')
            }

            const draftId = Date.now().toString()
            window.sessionStorage.setItem(
                `parsedDocument:${draftId}`,
                JSON.stringify(payload.parsedDocument)
            )
            window.sessionStorage.setItem(
                `articleMeta:${draftId}`,
                JSON.stringify({
                    articleId: article.id,
                    sourceName: article.sourceName,
                    sourceUrl: article.sourceUrl,
                    title: article.title,
                })
            )

            const numQuestions = quizType === 'cloze' ? '20' : '5'
            router.push(
                `/quiz?quizType=${quizType}&difficulty=beginner&numQuestions=${numQuestions}&draftId=${draftId}`
            )
        } catch (error) {
            setErrorMessage(error.message || '生成失败，请稍后重试。')
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div className='min-h-screen py-8'>
            <div className='max-w-4xl mx-auto'>
                <div className='flex items-center justify-between mb-6'>
                    <Link href='/reading-hub' className='text-emerald-200 hover:underline'>
                        ← 返回文章来源中心
                    </Link>
                    <div className='flex gap-2'>
                        <button
                            className='border border-cyan-300/60 rounded px-3 py-1 text-sm text-cyan-200 hover:bg-cyan-300/10 disabled:opacity-50'
                            disabled={isGenerating || !article}
                            onClick={() => handleGenerateQuiz('reading')}
                        >
                            生成阅读理解（默认5题）
                        </button>
                        <button
                            className='border border-yellow-300/60 rounded px-3 py-1 text-sm text-yellow-200 hover:bg-yellow-300/10 disabled:opacity-50'
                            disabled={isGenerating || !article}
                            onClick={() => handleGenerateQuiz('cloze')}
                        >
                            生成完形填空（默认20空）
                        </button>
                    </div>
                </div>

                {errorMessage && (
                    <div className='border border-red-400/60 bg-red-400/10 rounded p-4 text-red-300 mb-4'>
                        {errorMessage}
                    </div>
                )}

                {isLoading ? (
                    <p className='text-white/70'>正在加载文章...</p>
                ) : article ? (
                    <article className='border border-white/20 rounded p-6 bg-black/20'>
                        <p className='text-xs text-emerald-300/80'>
                            {article.sourceName} ·{' '}
                            {new Date(article.publishedAt).toLocaleString()}
                        </p>
                        <h1 className='text-3xl font-bold mt-2'>{article.title}</h1>
                        <div className='mt-3 flex flex-wrap items-center gap-2 text-xs text-white/60'>
                            <span
                                className={
                                    article.difficulty === 'junior_friendly'
                                        ? 'rounded border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-emerald-200'
                                        : article.difficulty === 'standard'
                                          ? 'rounded border border-amber-400/35 bg-amber-500/12 px-2 py-0.5 text-amber-100'
                                          : 'rounded border border-rose-400/35 bg-rose-500/12 px-2 py-0.5 text-rose-100'
                                }
                            >
                                {article.difficulty === 'junior_friendly'
                                    ? '初中友好'
                                    : article.difficulty === 'standard'
                                      ? '一般'
                                      : '挑战'}
                                {typeof article.difficultyScore === 'number'
                                    ? ` · ${article.difficultyScore}`
                                    : ''}
                            </span>
                            <span>
                                约 {article.estimatedReadingMinutes} 分钟
                                {article.metrics?.words != null
                                    ? ` · ${article.metrics.words} 词`
                                    : ''}
                            </span>
                        </div>
                        {(article.difficultyReasons || []).length > 0 && (
                            <p className='text-xs text-white/50 mt-1.5'>
                                {(article.difficultyReasons || []).slice(0, 2).join(' · ')}
                            </p>
                        )}
                        <p className='text-sm text-white/60 mt-3'>{article.summary}</p>
                        <p className='mt-2 rounded border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100/90'>
                            提示：部分 RSS
                            来源仅提供摘要，正文可能不完整；用于出题时可能影响题干与依据质量。若需更完整材料，请打开来源页复制全文后，回到首页粘贴或上传。
                        </p>
                        <div className='mt-5 whitespace-pre-wrap leading-7 text-[15px] text-white/90'>
                            {article.content}
                        </div>
                        <div className='mt-6 border-t border-white/10 pt-4 text-xs text-white/60'>
                            <p>{article.licenseNote || '内容版权归原网站所有。'}</p>
                            <a
                                href={article.sourceUrl}
                                target='_blank'
                                className='text-emerald-200 hover:underline mt-2 inline-block'
                            >
                                查看原始来源
                            </a>
                            {!article.hasFullContent && (
                                <p className='mt-2 text-yellow-200/90'>
                                    当前仅展示可公开片段。如需更完整内容，可访问原文复制后粘贴到出题器。
                                </p>
                            )}
                        </div>
                    </article>
                ) : (
                    <p className='text-white/70'>未找到文章。</p>
                )}
            </div>
        </div>
    )
}
