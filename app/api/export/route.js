import { buildDocumentModel } from '../../../lib/export/buildDocumentModel'
import { renderDocxBuffer } from '../../../lib/export/renderDocx'
import { renderHtmlForStudent } from '../../../lib/export/renderHtml'
import { validateExportRequest } from '../../../lib/export/validateExportBundle'

export const runtime = 'nodejs'

export async function POST(request) {
    let body
    try {
        body = await request.json()
    } catch {
        return Response.json({ message: '请求体格式错误。', code: 'BAD_REQUEST' }, { status: 400 })
    }

    const validated = validateExportRequest(body)
    if (!validated.ok) {
        return Response.json(
            { message: validated.message, code: 'INVALID_EXPORT' },
            { status: 400 }
        )
    }

    const bundle = { ...body.bundle }
    if (body.includeEvidence != null) {
        bundle.exportPrefs = {
            ...bundle.exportPrefs,
            includeEvidenceInTeacher: Boolean(body.includeEvidence),
        }
    }

    const variant = body.variant || 'student'

    try {
        if (variant === 'pdf') {
            const model = buildDocumentModel(bundle, { variant: 'student' })
            const html = renderHtmlForStudent(model)
            // Return HTML; ExportToolbar opens it in a new window for browser-print-to-PDF.
            const encoded = encodeURIComponent(bundle.meta.title || '学生版')
            return new Response(html, {
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Content-Disposition': `inline; filename="${encoded}-学生版.html"`,
                },
            })
        }

        const docVariant = variant === 'teacher' ? 'teacher' : 'student'
        const model = buildDocumentModel(bundle, { variant: docVariant })
        const buf = await renderDocxBuffer(model)
        const suffix = variant === 'teacher' ? '教师版' : '学生版'
        const titleEncoded = encodeURIComponent(bundle.meta.title || suffix)

        return new Response(buf, {
            headers: {
                'Content-Type':
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${titleEncoded}-${suffix}.docx"`,
            },
        })
    } catch (err) {
        console.error('[export] failed:', err)
        return Response.json(
            {
                message:
                    '导出失败，请稍后重试。若仅 PDF 失败，可先导出 Word 后在 Word 里另存为 PDF。',
                code: 'EXPORT_FAILED',
            },
            { status: 500 }
        )
    }
}
