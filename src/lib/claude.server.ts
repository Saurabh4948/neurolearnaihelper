import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

import type { QuizQuestion } from '@/lib/studymind-data.server'

const anthropic = new Anthropic()
const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5'

function getTextFromBlocks(content: Anthropic.Messages.ContentBlock[]) {
  return content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

async function runClaudePrompt(system: string, prompt: string) {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 1400,
    system,
    messages: [{ role: 'user', content: prompt }],
  })

  return getTextFromBlocks(response.content)
}

const quizSchema = z.object({
  questions: z
    .array(
      z.object({
        prompt: z.string().min(8),
        choices: z.array(z.string().min(1)).length(4),
        answerIndex: z.number().int().min(0).max(3),
        explanation: z.string().min(8),
      }),
    )
    .min(1),
})

const flashcardSchema = z.object({
  cards: z
    .array(
      z.object({
        front: z.string().min(3),
        back: z.string().min(5),
        topic: z.string().min(2),
      }),
    )
    .min(1),
})

function extractJson(text: string) {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)\s*```/i)
  const raw = fencedMatch?.[1] ?? text
  return JSON.parse(raw)
}

export async function generateTutorReply(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
) {
  const context = history
    .slice(-10)
    .map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`)
    .join('\n')

  return runClaudePrompt(
    'You are StudyMind AI, a strict but supportive CSE tutor. Explain concepts with examples and actionable study advice. Keep answers concise and accurate.',
    `Conversation context:\n${context}\n\nStudent request:\n${message}`,
  )
}

export async function generateQuizWithClaude(input: {
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
  count: number
}) {
  const text = await runClaudePrompt(
    'You create high-quality CS quizzes. Return only JSON.',
    `Create ${input.count} multiple-choice questions for CSE students.
Topic: ${input.topic}
Difficulty: ${input.difficulty}

Return JSON with shape:
{"questions":[{"prompt":"...","choices":["...","...","...","..."],"answerIndex":0,"explanation":"..."}]}

Rules:
- Exactly four choices per question
- One correct answer
- Mix conceptual and practical reasoning`,
  )

  const parsed = quizSchema.parse(extractJson(text))
  const questions: QuizQuestion[] = parsed.questions.map((question) => ({
    id: crypto.randomUUID(),
    ...question,
  }))

  return questions
}

export async function generateFlashcardsWithClaude(input: {
  topic: string
  count: number
}) {
  const text = await runClaudePrompt(
    'You create high-yield flashcards for computer science students. Return only JSON.',
    `Generate ${input.count} flashcards for topic: ${input.topic}.
Return JSON with shape:
{"cards":[{"front":"...","back":"...","topic":"..."}]}
Keep fronts short and backs precise with one concrete example when useful.`,
  )

  return flashcardSchema.parse(extractJson(text)).cards
}

export async function explainCodeWithClaude(input: {
  code: string
  question: string
}) {
  return runClaudePrompt(
    'You are an expert code mentor for CSE students. Use markdown with sections: Summary, Step-by-step, Complexity, Pitfalls, and Next Practice.',
    `Student question: ${input.question || 'Explain this code in depth.'}\n\nCode:\n\n${input.code}`,
  )
}
