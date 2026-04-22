import { getStore } from '@netlify/blobs'

export type Theme = 'light' | 'dark'

export interface StudyMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface Flashcard {
  id: string
  front: string
  back: string
  topic: string
  createdAt: string
  lastReviewedAt: string | null
  reviewCount: number
  correctCount: number
}

export interface QuizQuestion {
  id: string
  prompt: string
  choices: string[]
  answerIndex: number
  explanation: string
}

export interface QuizAttempt {
  id: string
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
  score: number
  totalQuestions: number
  durationSeconds: number
  createdAt: string
}

export interface PomodoroSession {
  id: string
  focusTopic: string
  durationMinutes: number
  completedAt: string
}

export interface UserProfile {
  theme: Theme
  displayName: string
}

interface ActivityLog {
  id: string
  type: 'chat' | 'quiz' | 'flashcard' | 'pomodoro' | 'code-explain'
  createdAt: string
}

const store = getStore('studymind-data')

const keyFor = {
  profile: (userId: string) => `u/${userId}/profile`,
  chat: (userId: string, id: string) => `u/${userId}/chat/${id}`,
  flashcard: (userId: string, id: string) => `u/${userId}/flashcards/${id}`,
  quizAttempt: (userId: string, id: string) => `u/${userId}/quiz-attempts/${id}`,
  pomodoro: (userId: string, id: string) => `u/${userId}/pomodoro/${id}`,
  activity: (userId: string, id: string) => `u/${userId}/activity/${id}`,
}

const makeId = () => crypto.randomUUID()

const byDateAsc = <T extends { createdAt?: string; completedAt?: string }>(
  a: T,
  b: T,
) => {
  const left = a.createdAt ?? a.completedAt ?? ''
  const right = b.createdAt ?? b.completedAt ?? ''
  return left.localeCompare(right)
}

async function listPrefix<T>(prefix: string) {
  const { blobs } = await store.list({ prefix })
  const values = (await Promise.all(
    blobs.map((blob) => store.get(blob.key, { type: 'json' }) as Promise<T | null>),
  )) as Array<T | null>

  return values.filter((value): value is T => value !== null)
}

export async function getOrCreateProfile(userId: string, email: string) {
  const existing = await store.get(keyFor.profile(userId), { type: 'json' })

  if (existing) {
    return existing as UserProfile
  }

  const profile: UserProfile = {
    theme: 'dark',
    displayName: email.split('@')[0] || 'Student',
  }

  await store.setJSON(keyFor.profile(userId), profile)
  return profile
}

export async function saveTheme(userId: string, theme: Theme) {
  const profile = (await store.get(keyFor.profile(userId), { type: 'json' })) as
    | UserProfile
    | null

  const nextProfile: UserProfile = {
    theme,
    displayName: profile?.displayName ?? 'Student',
  }

  await store.setJSON(keyFor.profile(userId), nextProfile)
  return nextProfile
}

export async function getChatMessages(userId: string) {
  const messages = await listPrefix<StudyMessage>(`u/${userId}/chat/`)
  return messages.sort(byDateAsc)
}

export async function addChatMessage(
  userId: string,
  payload: Omit<StudyMessage, 'id' | 'createdAt'>,
) {
  const message: StudyMessage = {
    id: makeId(),
    createdAt: new Date().toISOString(),
    ...payload,
  }

  await store.setJSON(keyFor.chat(userId, message.id), message)
  return message
}

export async function getFlashcards(userId: string) {
  const cards = await listPrefix<Flashcard>(`u/${userId}/flashcards/`)
  return cards.sort(byDateAsc)
}

export async function addFlashcard(
  userId: string,
  payload: Pick<Flashcard, 'front' | 'back' | 'topic'>,
) {
  const card: Flashcard = {
    id: makeId(),
    front: payload.front,
    back: payload.back,
    topic: payload.topic,
    createdAt: new Date().toISOString(),
    lastReviewedAt: null,
    reviewCount: 0,
    correctCount: 0,
  }

  await store.setJSON(keyFor.flashcard(userId, card.id), card)
  return card
}

export async function reviewFlashcard(
  userId: string,
  cardId: string,
  isCorrect: boolean,
) {
  const existing = (await store.get(keyFor.flashcard(userId, cardId), {
    type: 'json',
  })) as Flashcard | null

  if (!existing) {
    throw new Error('Flashcard not found')
  }

  const updated: Flashcard = {
    ...existing,
    reviewCount: existing.reviewCount + 1,
    correctCount: existing.correctCount + (isCorrect ? 1 : 0),
    lastReviewedAt: new Date().toISOString(),
  }

  await store.setJSON(keyFor.flashcard(userId, cardId), updated)
  return updated
}

export async function getQuizAttempts(userId: string) {
  const attempts = await listPrefix<QuizAttempt>(`u/${userId}/quiz-attempts/`)
  return attempts.sort(byDateAsc)
}

export async function addQuizAttempt(
  userId: string,
  payload: Omit<QuizAttempt, 'id' | 'createdAt'>,
) {
  const attempt: QuizAttempt = {
    id: makeId(),
    createdAt: new Date().toISOString(),
    ...payload,
  }

  await store.setJSON(keyFor.quizAttempt(userId, attempt.id), attempt)
  return attempt
}

export async function getPomodoroSessions(userId: string) {
  const sessions = await listPrefix<PomodoroSession>(`u/${userId}/pomodoro/`)
  return sessions.sort(byDateAsc)
}

export async function addPomodoroSession(
  userId: string,
  payload: Omit<PomodoroSession, 'id' | 'completedAt'>,
) {
  const session: PomodoroSession = {
    id: makeId(),
    completedAt: new Date().toISOString(),
    ...payload,
  }

  await store.setJSON(keyFor.pomodoro(userId, session.id), session)
  return session
}

export async function addActivity(
  userId: string,
  type: ActivityLog['type'],
) {
  const activity: ActivityLog = {
    id: makeId(),
    type,
    createdAt: new Date().toISOString(),
  }

  await store.setJSON(keyFor.activity(userId, activity.id), activity)
  return activity
}

export async function getActivity(userId: string) {
  const logs = await listPrefix<ActivityLog>(`u/${userId}/activity/`)
  return logs.sort(byDateAsc)
}
