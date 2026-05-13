import { useEffect, useState } from 'react'

import { HiCheck, HiOutlineXMark } from 'react-icons/hi2'

// Question Format
// {
//     query: 'What is JS?',
//     choices: ['A', 'B', 'C', 'D'],
//     answer: '0',
//     explanation: 'Explanation',
// }

const Question = ({
    question,
    id,
    setNumSubmitted,
    setNumCorrect,
    onLocateEvidence,
    revealMode = 'per-question',
    isAllSubmitted = false,
    isRevealed = false,
    onRevealQuestion,
}) => {
    // const Question = ({ question, choices, explanation, answer }: QuestionProps) => {
    // const Question: React.FC<QuestionProps> = ({ question, choices, explanation, answer }: QuestionProps) => {

    const {
        query,
        choices,
        answer,
        explanationZh,
        sourceEvidence,
        sourcePosition,
        questionType,
        subType,
        blankIndex,
    } = question
    const [isSubmitted, setIsSubmitted] = useState(false)
    const [isExplained, setIsExplained] = useState(false)
    const [isSelected, setIsSelected] = useState(false)
    const [selectedChoiceIndex, setSelectedChoiceIndex] = useState(-1)

    // Probably not the best way to do this.
    // Should just make function to test if the choice index is the selectedIndex state variable.
    const [choiceObjects, setChoiceObjects] = useState(() =>
        choices.map((choice) => ({
            text: choice,
            isSelected: false,
        }))
    )

    const isCorrect = () => {
        return Number(answer) === selectedChoiceIndex
    }

    const handleChoiceSelect = (choiceIndex) => {
        if (isSubmitted) return

        // console.log('selected')

        setSelectedChoiceIndex(choiceIndex)
        setIsSelected(true)

        setChoiceObjects((prevChoiceObjects) =>
            prevChoiceObjects.map((choice, index) => {
                return {
                    ...choice,
                    isSelected: choiceIndex === index ? true : false,
                }
            })
        )
    }

    const handleAnswerSubmit = (e) => {
        // don't allow submitting more than once
        if (isSubmitted) return

        setIsSubmitted(true)

        setNumSubmitted((prevNumSubmitted) => prevNumSubmitted + 1)

        setSelectedChoiceIndex(
            choiceObjects.findIndex((choice) => choice.isSelected)
        )

        if (isCorrect()) {
            setNumCorrect((prevNumCorrect) => prevNumCorrect + 1)
            setIsExplained(true)
        }
    }

    const handleExplain = () => {
        setIsExplained(true)
        if (onRevealQuestion) onRevealQuestion(id)
    }

    const submitButtonStyles = () => {
        let style = isSelected
            ? 'pointer-events-auto bg-cyan-600/75'
            : 'pointer-events-none border-gray-500 bg-stone-700'
        style = isSubmitted
            ? 'pointer-events-none border-gray-500 bg-stone-700 opacity-50'
            : style
        return style
    }

    const explainButtonStyles = () => {
        let style = isExplained
            ? 'pointer-events-none opacity-50'
            : 'pointer-events-auto'
        if (questionType === 'cloze' && revealMode === 'after-all' && !isAllSubmitted) {
            style = 'pointer-events-none opacity-50'
        }
        return style
    }

    const renderChoices = () => {
        return choiceObjects?.map((choice, index) => {
            let style = ''

            style = choice.isSelected
                ? 'border-cyan-600/75 bg-cyan-600/20'
                : 'border-gray-500 hover:bg-cyan-600/10'

            let checkOrX = null

            if (isSubmitted) {
                if (index === selectedChoiceIndex) {
                    if (isCorrect()) {
                        style = 'border-emerald-300 bg-emerald-300/10'
                        checkOrX = (
                            <div>
                                <HiCheck size={30} color='#6ee7b7' />
                            </div>
                        )
                    } else {
                        style = 'border-red-400 bg-red-400/10'
                        checkOrX = (
                            <div>
                                <HiOutlineXMark size={30} color='#f87171' />
                            </div>
                        )
                    }
                }
            }

            if (isExplained) {
                if (index === Number(answer)) {
                    style = 'border-emerald-300 bg-emerald-300/10'
                    checkOrX = (
                        <div>
                            <HiCheck size={30} color='#6ee7b7' />
                        </div>
                    )
                }
            }

            return (
                <div
                    key={index}
                    className={`w-full p-4 text-left border rounded cursor-pointer ${style} flex items-center justify-between`}
                    onClick={() => handleChoiceSelect(index)}
                >
                    <pre className=' whitespace-pre-wrap'>
                        {/* <code>{choice.text}</code> */}
                        {/* <code className=' bg-opacity-0 '>{choice.text}</code> */}
                        <code
                            className='rounded'
                            style={{
                                padding: 5,
                                backgroundColor: 'transparent',
                            }}
                        >
                            {choice.text}
                        </code>
                    </pre>

                    {checkOrX}
                </div>
            )
        })
    }

    useEffect(() => {
        // Probably not a good way to do this.
        // Maybe each choice should be it's own component at this point.
        setChoiceObjects(
            choices.map((choice) => ({
                text: choice,
                isSelected: false,
            }))
        )
    }, [choices])

    return (
        <div className='max-w-3xl mx-auto'>
            <h2 className='text-sm font-semibold text-gray-300/80'>
                第 {id + 1} 题
            </h2>
            <p className='text-xs text-emerald-300/70 mb-2'>
                {questionType === 'cloze'
                    ? `完形填空 · 第 ${blankIndex || id + 1} 空`
                    : `阅读理解 · ${subType || 'detail'}`}
            </p>
            <div className='border border-gray-500/0 rounded'>
                <div className='py-2 mt-2 text-xl'>{query}</div>
                <div className='grid gap-2 mt-4'>{renderChoices()}</div>
                <div className='flex items-center justify-end gap-2 mt-2 itesm'>
                    {isSubmitted && (
                        <button
                            onClick={handleExplain}
                            title={
                                questionType === 'cloze' &&
                                revealMode === 'after-all' &&
                                !isAllSubmitted
                                    ? '请先完成全部题目并点击「提交全部」，或切换到「逐题查看解析」。'
                                    : ''
                            }
                            className={`px-6 py-3  border-gray-500 rounded bg-stone-700 hover:bg-stone-600 ${explainButtonStyles()}`}
                        >
                            {questionType === 'cloze' ? '查看该题解析/答案' : '查看解析'}
                        </button>
                    )}
                    <button
                        onClick={handleAnswerSubmit}
                        className={`px-6 py-3   rounded ${submitButtonStyles()}`}
                    >
                        {isSubmitted ? '已提交' : '提交答案'}
                    </button>
                </div>
                {(questionType === 'cloze'
                    ? (isAllSubmitted || isRevealed || isExplained) && isSubmitted
                    : (isSubmitted && isCorrect()) || isExplained) && (
                    <div className='mt-2 p-4 rounded bg-stone-700/50'>
                        <h3 className='text-emerald-300/60 text-sm font-bold'>
                            解析
                        </h3>
                        <p className='mt-2 text-sm font-light'>{explanationZh}</p>
                        {sourceEvidence &&
                            (questionType !== 'cloze' || isAllSubmitted || isRevealed) && (
                            <div className='mt-3 text-xs text-white/75 border border-white/10 rounded p-3'>
                                <p className='text-emerald-200'>
                                    依据：{sourceEvidence}
                                </p>
                                <p className='mt-1 text-white/60'>
                                    定位：第 {sourcePosition?.page || 1} 页，第{' '}
                                    {sourcePosition?.lineStart || 1} 行
                                    {sourcePosition?.precision === 'approximate'
                                        ? '（近似）'
                                        : '（精确）'}
                                </p>
                                <button
                                    type='button'
                                    onClick={() =>
                                        onLocateEvidence &&
                                        onLocateEvidence(sourcePosition, {
                                            questionNo: id + 1,
                                            questionType,
                                            sourceEvidence,
                                        })
                                    }
                                    className='mt-2 border border-emerald-300/70 rounded px-3 py-1 text-emerald-200 hover:bg-emerald-300/15'
                                >
                                    查看原文依据
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
export default Question
