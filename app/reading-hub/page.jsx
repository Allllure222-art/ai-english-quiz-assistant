'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import { READING_RESOURCE_LINKS } from '../constants/readingResourceLinks'

const categories = [
    { value: 'all', label: '全部' },
    { value: 'news', label: '新闻' },
    { value: 'technology', label: '科技' },
    { value: 'business', label: '商业' },
    { value: 'science', label: '科学' },
    { value: 'culture', label: '文化' },
]

const difficulties = [
    { value: 'all', label: '全部难度' },
    { value: 'junior_friendly', label: '初中友好' },
    { value: 'standard', label: '一般' },
    { value: 'challenging', label: '挑战' },
]

export default function ReadingHubPage() {
    const [category, setCategory] = useState('all')
    const [difficulty, setDifficulty] = useState('all')
    const [keyword, setKeyword] = useState('')
    const [articles, setArticles] = useState([])
    const [pagination, setPagination] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [page, setPage] = useState(1)

    const queryString = useMemo(() => {
        const params = new URLSearchParams({
            category,
            difficulty,
            keyword,
            page: String(page),
            pageSize: '9',
        })
        return params.toString()
    }, [category, difficulty, keyword, page])

    useEffect(() => {
        const controller = new AbortController()

        const loadArticles = async () => {
            try {
                setIsLoading(true)
                setErrorMessage('')
                const response = await fetch(`/api/reading/articles?${queryString}`, {
                    signal: controller.signal,
                })
                const payload = await response.json()
                if (!response.ok) {
                    throw new Error(payload?.message || '文章加载失败，请稍后重试。')
                }
                setArticles(payload.data || [])
                setPagination(payload.pagination || null)
            } catch (error) {
                if (error.name !== 'AbortError') {
                    setErrorMessage(error.message || '文章加载失败，请稍后重试。')
                }
            } finally {
                setIsLoading(false)
            }
        }

        loadArticles()
        return () => controller.abort()
    }, [queryString])

    return (
        <div className='min-h-screen py-10'>
            <div className='max-w-6xl mx-auto'>
                <div className='flex items-center justify-between flex-wrap gap-4 mb-6'>
                    <div>
                        <h1 className='text-4xl font-bold text-emerald-200'>
                            阅读材料中心
                        </h1>
                        <p className='text-white/70 mt-2'>
                            选一篇作为阅读材料，进入备课台生成可打印练习（Word / PDF）。
                        </p>
                    </div>
                    <Link href='/' className='q-button !mt-0'>
                        返回备课主页
                    </Link>
                </div>

                <section className='mb-8 rounded border border-cyan-300/30 bg-black/20 p-4'>
                    <h2 className='text-lg font-semibold text-cyan-200'>
                        推荐阅读材料（外链）
                    </h2>
                    <p className='mt-1 text-xs leading-relaxed text-white/55'>
                        在浏览器中打开下列网站，选择文章后<strong>手动复制</strong>英文正文到首页「粘贴英文材料」；本站不自动抓取第三方全文，以尊重版权与站点条款。
                    </p>
                    <div className='mt-3 grid gap-3 sm:grid-cols-2'>
                        {READING_RESOURCE_LINKS.map((item) => (
                            <a
                                key={item.id}
                                href={item.url}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='block rounded border border-white/15 p-3 transition hover:bg-white/5'
                            >
                                <p className='text-sm font-medium text-emerald-200/95'>
                                    {item.name}
                                </p>
                                <p className='mt-1 text-xs text-white/55'>{item.blurb}</p>
                                <p className='mt-2 truncate text-[11px] text-cyan-200/80'>
                                    {item.url}
                                </p>
                            </a>
                        ))}
                    </div>
                </section>

                <p className='mb-4 text-xs leading-relaxed text-amber-200/90'>
                    下方为 RSS 聚合的短文（摘要为主）；若出题时原文依据偏少，请优先使用上方外链中的完整文章。
                </p>

                <div className='grid md:grid-cols-4 gap-3 mb-6'>
                    <select
                        value={category}
                        onChange={(e) => {
                            setPage(1)
                            setCategory(e.target.value)
                        }}
                        className='quiz-select'
                    >
                        {categories.map((item) => (
                            <option key={item.value} value={item.value}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                    <select
                        value={difficulty}
                        onChange={(e) => {
                            setPage(1)
                            setDifficulty(e.target.value)
                        }}
                        className='quiz-select'
                    >
                        {difficulties.map((item) => (
                            <option key={item.value} value={item.value}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                    <input
                        className='quiz-select px-3 py-2'
                        value={keyword}
                        onChange={(e) => {
                            setPage(1)
                            setKeyword(e.target.value)
                        }}
                        placeholder='搜索标题关键词'
                    />
                    <button
                        className='border border-white/30 rounded px-3 py-2 hover:bg-white/10'
                        onClick={() => {
                            setKeyword('')
                            setCategory('all')
                            setDifficulty('all')
                            setPage(1)
                        }}
                    >
                        重置筛选
                    </button>
                </div>

                {errorMessage && (
                    <div className='border border-red-400/60 bg-red-400/10 rounded p-4 text-red-300 mb-4'>
                        {errorMessage}
                    </div>
                )}

                {isLoading ? (
                    <div className='text-white/70'>正在加载文章...</div>
                ) : (
                    <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-4'>
                        {articles.map((article) => (
                            <article
                                key={article.id}
                                className='border border-white/20 rounded p-4 bg-black/20'
                            >
                                <p className='text-xs text-emerald-300/80'>
                                    {article.sourceName} ·{' '}
                                    {new Date(article.publishedAt).toLocaleDateString()}
                                </p>
                                <h3 className='text-lg font-semibold mt-2 line-clamp-2'>
                                    {article.title}
                                </h3>
                                <p className='text-sm text-white/70 mt-2 line-clamp-3'>
                                    {article.summary}
                                </p>
                                <div className='mt-2 flex flex-wrap items-center gap-2 text-xs'>
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
                                    <span className='text-white/45'>
                                        约 {article.estimatedReadingMinutes} 分钟
                                    </span>
                                </div>
                                {(article.difficultyReasons || []).length > 0 && (
                                    <p className='text-[11px] text-white/55 mt-1.5 line-clamp-2'>
                                        {(article.difficultyReasons || [])
                                            .slice(0, 2)
                                            .join(' · ')}
                                    </p>
                                )}
                                <div className='mt-4 flex gap-2'>
                                    <Link
                                        href={`/reading/${article.id}`}
                                        className='border border-emerald-300/60 rounded px-3 py-1 text-sm text-emerald-200 hover:bg-emerald-300/10'
                                    >
                                        全文阅读
                                    </Link>
                                    <Link
                                        href={`/reading/${article.id}?action=quiz&quizType=reading`}
                                        className='border border-cyan-300/60 rounded px-3 py-1 text-sm text-cyan-200 hover:bg-cyan-300/10'
                                    >
                                        用此文备课
                                    </Link>
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                {pagination && (
                    <div className='flex items-center justify-between mt-6 text-sm text-white/70'>
                        <p>
                            第 {pagination.page} / {pagination.totalPages} 页 · 共{' '}
                            {pagination.total} 篇
                        </p>
                        <div className='flex gap-2'>
                            <button
                                className='border border-white/20 rounded px-3 py-1 disabled:opacity-40'
                                disabled={pagination.page <= 1}
                                onClick={() => setPage((prev) => prev - 1)}
                            >
                                上一页
                            </button>
                            <button
                                className='border border-white/20 rounded px-3 py-1 disabled:opacity-40'
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => setPage((prev) => prev + 1)}
                            >
                                下一页
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
