function normalize(value) {
    return (value || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function locateInLine(lineText, quote) {
    const lineNorm = normalize(lineText)
    const quoteNorm = normalize(quote)
    if (!lineNorm || !quoteNorm) return -1
    return lineNorm.indexOf(quoteNorm)
}

export function buildApproximatePosition(parsedDocument, quote) {
    const firstPage = parsedDocument?.pages?.[0]
    const firstLine = firstPage?.lines?.[0]
    return {
        page: firstPage?.pageNumber || 1,
        lineStart: firstLine?.lineNumber || 1,
        lineEnd: firstLine?.lineNumber || 1,
        charStart: 0,
        charEnd: 0,
        quote: quote || '',
        precision: 'approximate',
    }
}

export function locateEvidencePosition(parsedDocument, quote) {
    const quoteNorm = normalize(quote)
    if (!quoteNorm) {
        return buildApproximatePosition(parsedDocument, quote)
    }

    for (const page of parsedDocument.pages || []) {
        for (const line of page.lines || []) {
            const startIndex = locateInLine(line.text, quoteNorm)
            if (startIndex >= 0) {
                return {
                    page: page.pageNumber,
                    lineStart: line.lineNumber,
                    lineEnd: line.lineNumber,
                    charStart: startIndex,
                    charEnd: startIndex + quoteNorm.length,
                    quote,
                    precision: 'exact',
                }
            }
        }
    }

    return buildApproximatePosition(parsedDocument, quote)
}

export function attachEvidencePositions(questions, parsedDocument) {
    return (questions || []).map((question) => {
        const quote =
            question?.sourcePosition?.quote ||
            question?.sourceEvidence ||
            question?.explanation ||
            ''

        const sourcePosition = locateEvidencePosition(parsedDocument, quote)
        return {
            ...question,
            sourceEvidence: question?.sourceEvidence || quote,
            sourcePosition,
        }
    })
}
