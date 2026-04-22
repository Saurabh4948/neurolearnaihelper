import { createServerFn } from '@tanstack/react-start'
import { getUser } from '@netlify/identity'
import { z } from 'zod'

import {
  addActivity,
  addChatMessage,
  addFlashcard,
  addPomodoroSession,
  addQuizAttempt,
  getActivity,
  getChatMessages,
  getFlashcards,
  getOrCreateProfile,
  getPomodoroSessions,
  getQuizAttempts,
  reviewFlashcard,
  saveTheme,
  type QuizQuestion,
} from '@/lib/studymind-data.server'
import {
  explainCodeWithClaude,
  generateFlashcardsWithClaude,
  generateQuizWithClaude,
  generateTutorReply,
} from '@/lib/claude.server'

const requireUser = async () => {
  const user = await getUser()
  if (!user?.id || !user.email) {
    throw new Error('Authentication required')
  }

  return user as typeof user & { id: string; email: string }
}

export const getDashboardData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser()
    const [profile, chatMessages, flashcards, quizAttempts, sessions, activity] =
      await Promise.all([
        getOrCreateProfile(user.id, user.email),
        getChatMessages(user.id),
        getFlashcards(user.id),
        getQuizAttempts(user.id),
        getPomodoroSessions(user.id),
        getActivity(user.id),
      ])

    return {
      user: { id: user.id, email: user.email },
      profile,
      chatMessages,
      flashcards,
      quizAttempts,
      pomodoroSessions: sessions,
      activity,
    }
  },
)

export const askTutor = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      message: z.string().min(3).max(4000),
      history: z
        .array(
          z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string().min(1).max(4000),
          }),
        )
        .max(20),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    await addChatMessage(user.id, { role: 'user', content: data.message })
    const response = await generateTutorReply(data.message, data.history)
    await addChatMessage(user.id, { role: 'assistant', content: response })
    await addActivity(user.id, 'chat')
    return response
  })

export const generateQuiz = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      topic: z.string().min(3).max(120),
      difficulty: z.enum(['easy', 'medium', 'hard']),
      count: z.number().int().min(3).max(15),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    const questions = await generateQuizWithClaude(data)
    await addActivity(user.id, 'quiz')
    return questions
  })

export const saveQuizAttempt = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      topic: z.string().min(3).max(120),
      difficulty: z.enum(['easy', 'medium', 'hard']),
      score: z.number().int().min(0),
      totalQuestions: z.number().int().min(1),
      durationSeconds: z.number().int().min(0).max(86400),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    const attempt = await addQuizAttempt(user.id, data)
    await addActivity(user.id, 'quiz')
    return attempt
  })

export const createFlashcard = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      front: z.string().min(3).max(200),
      back: z.string().min(3).max(600),
      topic: z.string().min(2).max(120),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    const card = await addFlashcard(user.id, data)
    await addActivity(user.id, 'flashcard')
    return card
  })

export const generateFlashcards = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      topic: z.string().min(3).max(120),
      count: z.number().int().min(3).max(12),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    const generated = await generateFlashcardsWithClaude(data)
    const created = await Promise.all(
      generated.map((card) => addFlashcard(user.id, card)),
    )
    await addActivity(user.id, 'flashcard')
    return created
  })

export const markFlashcardReview = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      cardId: z.string().uuid(),
      isCorrect: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    const updated = await reviewFlashcard(user.id, data.cardId, data.isCorrect)
    await addActivity(user.id, 'flashcard')
    return updated
  })

export const explainCode = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      code: z.string().min(10).max(12000),
      question: z.string().max(240).optional().default(''),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    const explanation = await explainCodeWithClaude(data)
    await addActivity(user.id, 'code-explain')
    return explanation
  })

export const completePomodoro = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      focusTopic: z.string().min(2).max(120),
      durationMinutes: z.number().int().min(1).max(120),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    const session = await addPomodoroSession(user.id, data)
    await addActivity(user.id, 'pomodoro')
    return session
  })

export const updateTheme = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ theme: z.enum(['light', 'dark']) }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    return saveTheme(user.id, data.theme)
  })

export interface QuizRun {
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
  questions: QuizQuestion[]
}
