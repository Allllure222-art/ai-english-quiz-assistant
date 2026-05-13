import { getReadingHubArticles } from '../../../../../lib/readingHub'

export async function GET(request, { params }) {
    try {
        const id = decodeURIComponent(params.id)
        const articles = await getReadingHubArticles()
        const article = articles.find(
            (item) => decodeURIComponent(item.id) === id || item.id === params.id
        )

        if (!article) {
            return Response.json(
                {
                    code: 'ARTICLE_NOT_FOUND',
                    message: '文章不存在或已下线，请返回列表重新选择。',
                },
                { status: 404 }
            )
        }

        return Response.json({ article })
    } catch (error) {
        return Response.json(
            {
                code: 'READING_ARTICLE_DETAIL_FAILED',
                message: '文章详情加载失败，请稍后重试。',
            },
            { status: 500 }
        )
    }
}
