import Parser from 'rss-parser'
import { enrichArticleDifficultyFields } from './articleDifficulty'

const parser = new Parser()
const CACHE_TTL_MS =
    Number(process.env.READING_CACHE_TTL_MINUTES || '45') * 60 * 1000

/** RSS 摘要多为 1 分钟阅读；词数门槛避免把正常条目全部滤掉。 */
const MIN_ARTICLE_WORDS =
    Number(process.env.READING_MIN_ARTICLE_WORDS || '60')

/**
 * avgSentenceLength < 5 表明内容是导航/标签列表而非真实文章（如 NASA RSS 返回站点导航文本）。
 * rareWordRatio < 0.01 且词数极少：纯数字/标点噪音。
 */
function passesListingGate(article) {
    const words = article.metrics?.words ?? 0
    const avgSentLen = article.metrics?.avgSentenceLength ?? 0
    return (
        Boolean(article.title?.trim()) &&
        Boolean(article.content?.trim()) &&
        words >= MIN_ARTICLE_WORDS &&
        avgSentLen >= 5
    )
}

const sourceConfigs = [
    {
        id: 'bbc-world',
        name: 'BBC World',
        category: 'news',
        feedUrl: 'https://feeds.bbci.co.uk/news/world/rss.xml',
        baseUrl: 'https://www.bbc.com',
        licenseNote: '内容版权归原来源网站所有。',
    },
    {
        id: 'guardian-science',
        name: 'The Guardian – Science',
        category: 'science',
        feedUrl: 'https://www.theguardian.com/science/rss',
        baseUrl: 'https://www.theguardian.com/science',
        licenseNote: '内容版权归原来源网站所有。',
    },
    {
        id: 'nyt-tech',
        name: 'NYTimes Technology',
        category: 'technology',
        feedUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
        baseUrl: 'https://www.nytimes.com',
        licenseNote: '内容版权归原来源网站所有。',
    },
]

const fallbackArticlesRaw = [
    {
        id: 'fallback-1',
        title: 'How Daily Reading Improves English Learning',
        sourceName: 'Reading Hub Sample',
        sourceUrl: 'https://example.com/reading-hub-sample-1',
        publishedAt: new Date().toISOString(),
        category: 'culture',
        summary:
            'A short article about why daily English reading helps vocabulary and comprehension.',
        content:
            'Reading in English every day can significantly improve vocabulary and comprehension. When students read regularly, they naturally meet words in context and remember them better. Teachers often suggest setting a small daily goal, such as reading one short article each evening. Over time, this habit builds confidence and makes exam passages easier.',
        language: 'en',
        licenseNote: '示例内容，仅用于功能演示。',
        hasFullContent: true,
    },
]

const fallbackArticles = fallbackArticlesRaw.map((item) => ({
    ...item,
    ...enrichArticleDifficultyFields(item.content || item.summary || ''),
}))

const cache = {
    articles: [],
    lastUpdatedAt: 0,
}

function decodeHtmlEntities(text) {
    if (!text) return ''
    return text
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16))
        )
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
}

function stripHtml(value) {
    return decodeHtmlEntities(
        (value || '')
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
    )
}

function toArticle(source, item) {
    const title = stripHtml(item.title || 'Untitled')
    const summary = stripHtml(item.contentSnippet || item.summary || '')
    const content = stripHtml(
        item['content:encoded'] || item.content || item.contentSnippet || ''
    )
    const articleId = encodeURIComponent(`${source.id}::${item.guid || item.link || title}`)
    const normalizedContent = content || summary
    const difficultyFields = enrichArticleDifficultyFields(normalizedContent)
    return {
        id: articleId,
        title,
        sourceName: source.name,
        sourceUrl: item.link || source.baseUrl,
        publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
        category: source.category,
        summary: summary || normalizedContent.slice(0, 180),
        content: normalizedContent,
        language: 'en',
        licenseNote: source.licenseNote,
        ...difficultyFields,
        hasFullContent: Boolean(content),
    }
}

async function fetchSourceArticles(source) {
    const feed = await parser.parseURL(source.feedUrl)
    return (feed.items || [])
        .slice(0, 24)
        .map((item) => toArticle(source, item))
        .filter(passesListingGate)
}

export async function getReadingHubArticles() {
    if (
        cache.articles.length > 0 &&
        Date.now() - cache.lastUpdatedAt < CACHE_TTL_MS
    ) {
        return cache.articles
    }

    const results = await Promise.allSettled(
        sourceConfigs.map((source) => fetchSourceArticles(source))
    )
    const successArticles = results
        .filter((result) => result.status === 'fulfilled')
        .flatMap((result) => result.value)
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))

    let articles = successArticles.length ? successArticles : fallbackArticles
    articles = articles.filter(passesListingGate)
    if (!articles.length) {
        articles = fallbackArticles.filter(passesListingGate)
    }
    cache.articles = articles
    cache.lastUpdatedAt = Date.now()
    return articles
}

export function filterArticles(
    articles,
    { category = 'all', difficulty = 'all', keyword = '' }
) {
    const kw = keyword.trim().toLowerCase()
    return articles.filter((article) => {
        const categoryOk = category === 'all' || article.category === category
        const difficultyOk =
            difficulty === 'all' || article.difficulty === difficulty
        const keywordOk =
            !kw || article.title.toLowerCase().includes(kw)
        return categoryOk && difficultyOk && keywordOk
    })
}

export function paginateArticles(articles, page = 1, pageSize = 10) {
    const safePage = Number(page) > 0 ? Number(page) : 1
    const safeSize = Number(pageSize) > 0 ? Number(pageSize) : 10
    const start = (safePage - 1) * safeSize
    const data = articles.slice(start, start + safeSize)
    return {
        data,
        pagination: {
            page: safePage,
            pageSize: safeSize,
            total: articles.length,
            totalPages: Math.max(1, Math.ceil(articles.length / safeSize)),
        },
    }
}

export function getSourceSummaries() {
    return sourceConfigs.map((source) => ({
        id: source.id,
        name: source.name,
        category: source.category,
        feedUrl: source.feedUrl,
    }))
}
