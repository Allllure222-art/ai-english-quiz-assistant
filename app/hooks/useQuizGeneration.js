'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
    QUIZ_FETCH_TIMEOUT_MS,
    mapQuizFetchFailure,
} from '../../lib/quizGenerationClient'

/**
 * Shared quiz generation hook.
 * onSuccess({ questions, parsedDocument, articleMeta }) is called on success.
 */
export function useQuizGeneration({
    quizType,
    difficulty,
    numQuestions,
    draftId,
    generationKey,
    onSuccess,
}) {
    const [isLoading, setIsLoading] = useState(false)
    const [errorDetail, setErrorDetail] = useState(null)
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const abortRef = useRef(null)
    const abortKindRef = useRef('')

    const cancel = useCallback(() => {
        abortKindRef.current = 'user'
        abortRef.current?.abort()
    }, [])

    useEffect(() => {
        if (!draftId || !quizType) return

        let disposed = false
        let tick = null
        const ac = new AbortController()
        abortRef.current = ac
        abortKindRef.current = ''

        const timer = setTimeout(() => {
            abortKindRef.current = 'timeout'
            ac.abort()
        }, QUIZ_FETCH_TIMEOUT_MS)

        const run = async () => {
            setIsLoading(true)
            setErrorDetail(null)
            setElapsedSeconds(0)
            tick = setInterval(() => {
                setElapsedSeconds((s) => s + 1)
            }, 1000)

            try {
                const parsedDocumentRaw = window.sessionStorage.getItem(
                    `parsedDocument:${draftId}`
                )
                if (!parsedDocumentRaw) {
                    if (!disposed) {
                        setErrorDetail({
                            code: 'MISSING_DOCUMENT',
                            headline: '材料已失效',
                            body: '请返回首页重新粘贴或上传。',
                        })
                    }
                    return
                }
                const parsedDoc = JSON.parse(parsedDocumentRaw)
                if (disposed) return

                const articleMetaRaw = window.sessionStorage.getItem(
                    `articleMeta:${draftId}`
                )
                const articleMeta = articleMetaRaw
                    ? JSON.parse(articleMetaRaw)
                    : null

                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        quizType,
                        difficulty,
                        numQuestions,
                        parsedDocument: parsedDoc,
                    }),
                    signal: ac.signal,
                })

                const payload = await response.json().catch(() => null)

                if (!response.ok) {
                    const mapped = mapQuizFetchFailure({
                        status: response.status,
                        code: payload?.code,
                        message: payload?.message,
                    })
                    if (!disposed) setErrorDetail(mapped)
                    return
                }

                if (!payload?.questions?.length) {
                    const mapped = mapQuizFetchFailure({
                        status: 422,
                        message: '返回内容为空，请重试。',
                    })
                    if (!disposed) setErrorDetail(mapped)
                    return
                }

                if (!disposed) {
                    onSuccess?.({ questions: payload.questions, parsedDocument: parsedDoc, articleMeta })
                }
            } catch (err) {
                if (disposed) return
                if (err?.name === 'AbortError') {
                    const kind = abortKindRef.current
                    if (kind === 'unmount') return
                    const mapped = mapQuizFetchFailure({
                        isAbort: kind === 'user',
                        isTimeout: kind === 'timeout',
                    })
                    setErrorDetail(mapped)
                    return
                }
                const mapped = mapQuizFetchFailure({
                    isNetwork:
                        err?.message === 'Failed to fetch' ||
                        err?.name === 'TypeError',
                })
                setErrorDetail(mapped)
            } finally {
                clearInterval(tick)
                clearTimeout(timer)
                if (!disposed) setIsLoading(false)
            }
        }

        run()

        return () => {
            disposed = true
            clearInterval(tick)
            clearTimeout(timer)
            abortKindRef.current = 'unmount'
            ac.abort()
            if (abortRef.current === ac) abortRef.current = null
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quizType, difficulty, numQuestions, draftId, generationKey])

    return { isLoading, errorDetail, elapsedSeconds, cancel, abortKindRef }
}
