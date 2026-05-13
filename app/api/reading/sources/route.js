import { getSourceSummaries } from '../../../../lib/readingHub'

export async function GET() {
    return Response.json({
        sources: getSourceSummaries(),
    })
}
