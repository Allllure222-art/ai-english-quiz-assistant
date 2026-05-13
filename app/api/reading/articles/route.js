import {
    filterArticles,
    getReadingHubArticles,
    paginateArticles,
} from '../../../../lib/readingHub'

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        const category = searchParams.get('category') || 'all'
        const difficulty = searchParams.get('difficulty') || 'all'
        const keyword = searchParams.get('keyword') || ''
        const page = Number(searchParams.get('page') || '1')
        const pageSize = Number(searchParams.get('pageSize') || '10')

        const articles = await getReadingHubArticles()
        const filtered = filterArticles(articles, { category, difficulty, keyword })
        const { data, pagination } = paginateArticles(filtered, page, pageSize)

        return Response.json({
            data,
            pagination,
        })
    } catch (error) {
        return Response.json(
            {
                code: 'READING_ARTICLE_LIST_FAILED',
                message: '文章列表加载失败，请稍后重试。',
            },
            { status: 500 }
        )
    }
}
