import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from 'react'
import { Streamdown } from 'streamdown'
import { logout } from '@netlify/identity'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'

import { getCurrentUser } from '@/lib/auth'
import {
  askTutor,
  completePomodoro,
  createFlashcard,
  explainCode,
  generateFlashcards,
  generateQuiz,
  getDashboardData,
  markFlashcardReview,
  saveQuizAttempt,
  updateTheme,
  type QuizRun,
} from '@/lib/studymind.functions'
import type {
  Flashcard,
  PomodoroSession,
  QuizAttempt,
  StudyMessage,
  Theme,
} from '@/lib/studymind-data.server'

export const Route = createFileRoute('/app')({
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (!user) {
      throw redirect({ to: '/auth' })
    }
  },
  loader: async () => getDashboardData(),
  component: AppPage,
})

type TabKey =
  | 'tutor'
  | 'quiz'
  | 'flashcards'
  | 'code'
  | 'pomodoro'
  | 'analytics'

const tabLabels: Array<{ key: TabKey; label: string }> = [
  { key: 'tutor', label: 'AI Tutor' },
  { key: 'quiz', label: 'Quiz Engine' },
  { key: 'flashcards', label: 'Flashcards' },
  { key: 'code', label: 'Code Explainer' },
  { key: 'pomodoro', label: 'Pomodoro' },
  { key: 'analytics', label: 'Analytics' },
]

function AppPage() {
  const initial = Route.useLoaderData()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabKey>('tutor')
  const [theme, setTheme] = useState<Theme>(initial.profile.theme)
  const [messages, setMessages] = useState<StudyMessage[]>(initial.chatMessages)
  const [tutorInput, setTutorInput] = useState('')
  const [isTutorLoading, setIsTutorLoading] = useState(false)
  const [tutorError, setTutorError] = useState('')
  const [flashcards, setFlashcards] = useState<Flashcard[]>(initial.flashcards)
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>(
    initial.quizAttempts,
  )
  const [pomodoroSessions, setPomodoroSessions] = useState<PomodoroSession[]>(
    initial.pomodoroSessions,
  )
  const [notification, setNotification] = useState('')
  const messagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages, isTutorLoading])

  useEffect(() => {
    if (!notification) {
      return
    }
    const timeout = window.setTimeout(() => setNotification(''), 2200)
    return () => window.clearTimeout(timeout)
  }, [notification])

  const analytics = useMemo(() => {
    const quizScoreAverage = quizAttempts.length
      ? Math.round(
          (quizAttempts.reduce((sum, attempt) => {
            return sum + (attempt.score / attempt.totalQuestions) * 100
          }, 0) /
            quizAttempts.length) *
            10,
        ) / 10
      : 0

    const focusMinutes = pomodoroSessions.reduce(
      (sum, session) => sum + session.durationMinutes,
      0,
    )

    const reviewedCards = flashcards.filter((card) => card.reviewCount > 0).length

    const topicMap = new Map<string, number>()
    flashcards.forEach((card) => {
      topicMap.set(card.topic, (topicMap.get(card.topic) ?? 0) + 1)
    })
    const topicBreakdown = [...topicMap.entries()]
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    return {
      quizScoreAverage,
      focusMinutes,
      reviewedCards,
      topicBreakdown,
      totalChats: Math.floor(messages.length / 2),
    }
  }, [flashcards, messages.length, pomodoroSessions, quizAttempts])

  const onSignOut = async () => {
    await logout()
    await navigate({ to: '/auth' })
  }

  const toggleTheme = async () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    await updateTheme({ data: { theme: nextTheme } })
  }

  const onTutorSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTutorError('')
    if (!tutorInput.trim()) {
      setTutorError('Enter a question before sending.')
      return
    }

    const userMessage: StudyMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: tutorInput.trim(),
      createdAt: new Date().toISOString(),
    }

    const history = [...messages, userMessage].map((message) => ({
      role: message.role,
      content: message.content,
    }))

    setMessages((current) => [...current, userMessage])
    setTutorInput('')
    setIsTutorLoading(true)

    try {
      const answer = await askTutor({
        data: {
          message: userMessage.content,
          history,
        },
      })

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: answer,
          createdAt: new Date().toISOString(),
        },
      ])
    } catch {
      setTutorError('Tutor request failed. Retry in a few seconds.')
    } finally {
      setIsTutorLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <div className="app-background" aria-hidden="true" />
      <header className="app-header">
        <div>
          <p className="eyebrow">StudyMind AI</p>
          <h1>CSE Study Workspace</h1>
        </div>
        <div className="header-controls">
          <button type="button" className="button ghost" onClick={toggleTheme}>
            Theme: {theme === 'dark' ? 'Dark' : 'Light'}
          </button>
          <button type="button" className="button ghost" onClick={onSignOut}>
            Sign Out
          </button>
        </div>
      </header>

      <div className="layout-grid">
        <aside className="tab-rail">
          <p className="rail-label">{initial.user.email}</p>
          {tabLabels.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </aside>

        <section className="content-panel">
          {activeTab === 'tutor' && (
            <TutorPanel
              input={tutorInput}
              isLoading={isTutorLoading}
              messages={messages}
              onInputChange={setTutorInput}
              onSubmit={onTutorSubmit}
              error={tutorError}
              containerRef={messagesRef}
            />
          )}

          {activeTab === 'quiz' && (
            <QuizPanel
              onSavedAttempt={(attempt) =>
                setQuizAttempts((current) => [...current, attempt])
              }
            />
          )}

          {activeTab === 'flashcards' && (
            <FlashcardsPanel
              cards={flashcards}
              onCardsChange={setFlashcards}
              notify={setNotification}
            />
          )}

          {activeTab === 'code' && <CodeExplainerPanel />}

          {activeTab === 'pomodoro' && (
            <PomodoroPanel
              sessions={pomodoroSessions}
              onSessionSaved={(session) =>
                setPomodoroSessions((current) => [...current, session])
              }
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsPanel
              analytics={analytics}
              attempts={quizAttempts}
              sessions={pomodoroSessions}
            />
          )}
        </section>
      </div>

      {notification ? <div className="toast">{notification}</div> : null}
    </main>
  )
}

function TutorPanel(props: {
  input: string
  isLoading: boolean
  messages: StudyMessage[]
  onInputChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  error: string
  containerRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <div className="panel">
      <h2>Live AI Tutor</h2>
      <p className="panel-copy">
        Ask course-specific questions and get guidance tailored to CSE topics.
      </p>
      <div className="message-stack" ref={props.containerRef}>
        {props.messages.length === 0 ? (
          <div className="empty-state">Start by asking about any CSE topic.</div>
        ) : null}
        {props.messages.map((message) => (
          <article
            key={message.id}
            className={`message-bubble ${message.role === 'assistant' ? 'assistant' : 'user'}`}
          >
            <span>{message.role === 'assistant' ? 'Tutor' : 'You'}</span>
            <Streamdown>{message.content}</Streamdown>
          </article>
        ))}
        {props.isLoading ? (
          <div className="skeleton-bubble">
            <span />
            <span />
            <span />
          </div>
        ) : null}
      </div>
      <form className="stack-form" onSubmit={props.onSubmit}>
        <textarea
          value={props.input}
          onChange={(event) => props.onInputChange(event.target.value)}
          placeholder="Explain why Dijkstra fails with negative edges..."
          rows={3}
          maxLength={4000}
        />
        {props.error ? <p className="form-error">{props.error}</p> : null}
        <button className="button solid" type="submit" disabled={props.isLoading}>
          {props.isLoading ? 'Thinking...' : 'Ask Tutor'}
        </button>
      </form>
    </div>
  )
}

function QuizPanel(props: {
  onSavedAttempt: (attempt: QuizAttempt) => void
}) {
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(
    'medium',
  )
  const [count, setCount] = useState(5)
  const [quizRun, setQuizRun] = useState<QuizRun | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [startedAt, setStartedAt] = useState<number>(0)
  const [result, setResult] = useState<QuizAttempt | null>(null)
  const [error, setError] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const onGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (topic.trim().length < 3) {
      setError('Topic must be at least 3 characters.')
      return
    }

    setIsGenerating(true)
    setResult(null)

    try {
      const questions = await generateQuiz({
        data: {
          topic: topic.trim(),
          difficulty,
          count,
        },
      })
      setQuizRun({ topic: topic.trim(), difficulty, questions })
      setAnswers({})
      setStartedAt(Date.now())
    } catch {
      setError('Unable to generate quiz. Please retry.')
    } finally {
      setIsGenerating(false)
    }
  }

  const onSubmitQuiz = async () => {
    if (!quizRun) {
      return
    }

    if (Object.keys(answers).length !== quizRun.questions.length) {
      setError('Answer every question before submitting.')
      return
    }

    const score = quizRun.questions.reduce((sum, question) => {
      return sum + (answers[question.id] === question.answerIndex ? 1 : 0)
    }, 0)

    setIsSaving(true)
    setError('')

    try {
      const attempt = await saveQuizAttempt({
        data: {
          topic: quizRun.topic,
          difficulty: quizRun.difficulty,
          score,
          totalQuestions: quizRun.questions.length,
          durationSeconds: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
        },
      })
      setResult(attempt)
      props.onSavedAttempt(attempt)
    } catch {
      setError('Failed to save your quiz result.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="panel">
      <h2>Quiz Engine</h2>
      <form className="row-form" onSubmit={onGenerate}>
        <input
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Topic (e.g., Dynamic Programming)"
          maxLength={120}
        />
        <select
          value={difficulty}
          onChange={(event) =>
            setDifficulty(event.target.value as 'easy' | 'medium' | 'hard')
          }
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <input
          type="number"
          min={3}
          max={15}
          value={count}
          onChange={(event) => setCount(Number(event.target.value))}
          aria-label="Question count"
        />
        <button type="submit" className="button solid" disabled={isGenerating}>
          {isGenerating ? 'Generating...' : 'Generate Quiz'}
        </button>
      </form>
      {error ? <p className="form-error">{error}</p> : null}
      {isGenerating ? (
        <div className="skeleton-grid">
          <span />
          <span />
          <span />
        </div>
      ) : null}
      {quizRun ? (
        <div className="quiz-stack">
          {quizRun.questions.map((question, index) => (
            <article key={question.id} className="quiz-card">
              <h3>
                Q{index + 1}. {question.prompt}
              </h3>
              <div className="quiz-options">
                {question.choices.map((choice, choiceIndex) => (
                  <label key={choice}>
                    <input
                      type="radio"
                      name={question.id}
                      checked={answers[question.id] === choiceIndex}
                      onChange={() =>
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: choiceIndex,
                        }))
                      }
                    />
                    {choice}
                  </label>
                ))}
              </div>
              {result ? (
                <p className="quiz-note">
                  Correct answer: {question.choices[question.answerIndex]}.
                  {` ${question.explanation}`}
                </p>
              ) : null}
            </article>
          ))}
          <button
            type="button"
            className="button solid"
            onClick={onSubmitQuiz}
            disabled={isSaving}
          >
            {isSaving ? 'Saving Result...' : 'Submit Quiz'}
          </button>
          {result ? (
            <p className="form-success">
              Score: {result.score}/{result.totalQuestions} saved.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function FlashcardsPanel(props: {
  cards: Flashcard[]
  onCardsChange: (cards: Flashcard[]) => void
  notify: (value: string) => void
}) {
  const [topic, setTopic] = useState('')
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [generationTopic, setGenerationTopic] = useState('')
  const [generationCount, setGenerationCount] = useState(5)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')

  const addManualCard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (front.trim().length < 3 || back.trim().length < 3 || topic.trim().length < 2) {
      setError('Topic, front, and back require meaningful content.')
      return
    }

    setIsSubmitting(true)
    try {
      const created = await createFlashcard({
        data: {
          topic: topic.trim(),
          front: front.trim(),
          back: back.trim(),
        },
      })
      props.onCardsChange([...props.cards, created])
      setFront('')
      setBack('')
      props.notify('Flashcard created.')
    } catch {
      setError('Failed to create flashcard.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const generateCards = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (generationTopic.trim().length < 3) {
      setError('Generation topic must be at least 3 characters.')
      return
    }
    setIsGenerating(true)
    try {
      const created = await generateFlashcards({
        data: { topic: generationTopic.trim(), count: generationCount },
      })
      props.onCardsChange([...props.cards, ...created])
      props.notify(`${created.length} flashcards added.`)
      setGenerationTopic('')
    } catch {
      setError('AI flashcard generation failed.')
    } finally {
      setIsGenerating(false)
    }
  }

  const markReview = async (card: Flashcard, isCorrect: boolean) => {
    const updated = await markFlashcardReview({
      data: { cardId: card.id, isCorrect },
    })
    props.onCardsChange(
      props.cards.map((existing) => (existing.id === card.id ? updated : existing)),
    )
  }

  return (
    <div className="panel">
      <h2>Flashcards</h2>
      <div className="split-form">
        <form onSubmit={addManualCard} className="stack-form">
          <h3>Create Manual Card</h3>
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Topic"
            maxLength={120}
          />
          <input
            value={front}
            onChange={(event) => setFront(event.target.value)}
            placeholder="Front prompt"
            maxLength={200}
          />
          <textarea
            value={back}
            onChange={(event) => setBack(event.target.value)}
            placeholder="Back explanation"
            rows={3}
            maxLength={600}
          />
          <button className="button solid" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Add Flashcard'}
          </button>
        </form>

        <form onSubmit={generateCards} className="stack-form">
          <h3>Generate with Claude</h3>
          <input
            value={generationTopic}
            onChange={(event) => setGenerationTopic(event.target.value)}
            placeholder="Topic for AI generation"
            maxLength={120}
          />
          <input
            type="number"
            value={generationCount}
            min={3}
            max={12}
            onChange={(event) => setGenerationCount(Number(event.target.value))}
          />
          <button className="button solid" type="submit" disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Generate Flashcards'}
          </button>
        </form>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {isGenerating ? (
        <div className="skeleton-grid">
          <span />
          <span />
        </div>
      ) : null}
      <div className="card-grid">
        {props.cards.length === 0 ? <p className="empty-state">No flashcards yet.</p> : null}
        {props.cards.map((card) => {
          const mastery =
            card.reviewCount > 0
              ? Math.round((card.correctCount / card.reviewCount) * 100)
              : 0
          return (
            <article key={card.id} className="flashcard">
              <p className="flash-topic">{card.topic}</p>
              <h3>{card.front}</h3>
              <p>{revealed[card.id] ? card.back : 'Tap reveal to view answer.'}</p>
              <p className="quiz-note">
                Reviews: {card.reviewCount} | Mastery: {mastery}%
              </p>
              <div className="card-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() =>
                    setRevealed((current) => ({
                      ...current,
                      [card.id]: !current[card.id],
                    }))
                  }
                >
                  {revealed[card.id] ? 'Hide' : 'Reveal'}
                </button>
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => markReview(card, true)}
                >
                  Mark Known
                </button>
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => markReview(card, false)}
                >
                  Needs Review
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function CodeExplainerPanel() {
  const [code, setCode] = useState('')
  const [question, setQuestion] = useState('')
  const [response, setResponse] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const onExplain = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (code.trim().length < 10) {
      setError('Paste at least 10 characters of code.')
      return
    }
    setIsLoading(true)
    try {
      const explanation = await explainCode({
        data: {
          code,
          question,
        },
      })
      setResponse(explanation)
    } catch {
      setError('Code explanation failed.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="panel">
      <h2>Code Explainer</h2>
      <form className="stack-form" onSubmit={onExplain}>
        <textarea
          value={code}
          onChange={(event) => setCode(event.target.value)}
          rows={10}
          placeholder="Paste C++, Java, Python, or JS code..."
        />
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Optional focus question (e.g., Why is this O(n log n)?)"
          maxLength={240}
        />
        {error ? <p className="form-error">{error}</p> : null}
        <button className="button solid" type="submit" disabled={isLoading}>
          {isLoading ? 'Analyzing...' : 'Explain Code'}
        </button>
      </form>
      {isLoading ? (
        <div className="skeleton-grid">
          <span />
          <span />
          <span />
        </div>
      ) : null}
      {response ? (
        <div className="markdown-panel">
          <Streamdown>{response}</Streamdown>
        </div>
      ) : null}
    </div>
  )
}

function PomodoroPanel(props: {
  sessions: PomodoroSession[]
  onSessionSaved: (session: PomodoroSession) => void
}) {
  const [minutes, setMinutes] = useState(25)
  const [focusTopic, setFocusTopic] = useState('Problem Solving')
  const [remaining, setRemaining] = useState(minutes * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isRunning) {
      return
    }
    setRemaining(minutes * 60)
  }, [minutes, isRunning])

  useEffect(() => {
    if (!isRunning) {
      return
    }

    const interval = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          window.clearInterval(interval)
          setIsRunning(false)
          return 0
        }
        return value - 1
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [isRunning])

  useEffect(() => {
    if (remaining !== 0 || isRunning || isSaving) {
      return
    }

    const persist = async () => {
      setError('')
      setIsSaving(true)
      try {
        const saved = await completePomodoro({
          data: {
            focusTopic: focusTopic.trim() || 'General Focus',
            durationMinutes: minutes,
          },
        })
        props.onSessionSaved(saved)
      } catch {
        setError('Session complete, but saving failed.')
      } finally {
        setIsSaving(false)
      }
    }

    persist()
  }, [focusTopic, isRunning, isSaving, minutes, props, remaining])

  return (
    <div className="panel">
      <h2>Pomodoro Timer</h2>
      <div className="timer-display">
        {String(Math.floor(remaining / 60)).padStart(2, '0')}:
        {String(remaining % 60).padStart(2, '0')}
      </div>
      <div className="row-form">
        <input
          type="number"
          min={1}
          max={120}
          value={minutes}
          onChange={(event) => setMinutes(Number(event.target.value))}
        />
        <input
          value={focusTopic}
          onChange={(event) => setFocusTopic(event.target.value)}
          placeholder="Focus topic"
          maxLength={120}
        />
        <button
          type="button"
          className="button solid"
          onClick={() => setIsRunning(true)}
          disabled={isRunning}
        >
          Start
        </button>
        <button
          type="button"
          className="button ghost"
          onClick={() => setIsRunning(false)}
          disabled={!isRunning}
        >
          Pause
        </button>
        <button
          type="button"
          className="button ghost"
          onClick={() => {
            setIsRunning(false)
            setRemaining(minutes * 60)
          }}
        >
          Reset
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {isSaving ? <p className="quiz-note">Saving completed session...</p> : null}
      <div className="mini-table">
        {props.sessions
          .slice()
          .reverse()
          .slice(0, 10)
          .map((session) => (
            <div key={session.id} className="mini-row">
              <span>{session.focusTopic}</span>
              <span>{session.durationMinutes} min</span>
              <span>{new Date(session.completedAt).toLocaleDateString()}</span>
            </div>
          ))}
      </div>
    </div>
  )
}

function AnalyticsPanel(props: {
  analytics: {
    quizScoreAverage: number
    focusMinutes: number
    reviewedCards: number
    topicBreakdown: Array<{ topic: string; count: number }>
    totalChats: number
  }
  attempts: QuizAttempt[]
  sessions: PomodoroSession[]
}) {
  const maxTopicCount = Math.max(
    1,
    ...props.analytics.topicBreakdown.map((entry) => entry.count),
  )

  return (
    <div className="panel">
      <h2>Study Analytics</h2>
      <div className="stats-grid">
        <article>
          <h3>{props.analytics.quizScoreAverage}%</h3>
          <p>Average quiz score</p>
        </article>
        <article>
          <h3>{props.analytics.focusMinutes}</h3>
          <p>Focus minutes completed</p>
        </article>
        <article>
          <h3>{props.analytics.reviewedCards}</h3>
          <p>Flashcards reviewed</p>
        </article>
        <article>
          <h3>{props.analytics.totalChats}</h3>
          <p>Tutor sessions</p>
        </article>
      </div>

      <div className="chart-card">
        <h3>Flashcard Topic Distribution</h3>
        {props.analytics.topicBreakdown.length === 0 ? (
          <p className="empty-state">Create flashcards to populate this chart.</p>
        ) : (
          <div className="bar-chart">
            {props.analytics.topicBreakdown.map((entry) => (
              <div key={entry.topic} className="bar-row">
                <span>{entry.topic}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(entry.count / maxTopicCount) * 100}%` }}
                  />
                </div>
                <strong>{entry.count}</strong>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="chart-card">
        <h3>Recent Activity</h3>
        <div className="mini-table">
          {props.attempts
            .slice()
            .reverse()
            .slice(0, 4)
            .map((attempt) => (
              <div className="mini-row" key={attempt.id}>
                <span>{attempt.topic}</span>
                <span>
                  {attempt.score}/{attempt.totalQuestions}
                </span>
                <span>{new Date(attempt.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          {props.sessions
            .slice()
            .reverse()
            .slice(0, 4)
            .map((session) => (
              <div className="mini-row" key={session.id}>
                <span>{session.focusTopic}</span>
                <span>{session.durationMinutes}m</span>
                <span>{new Date(session.completedAt).toLocaleDateString()}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
