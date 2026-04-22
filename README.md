# StudyMind AI

StudyMind AI is a production-grade AI Study Assistant built for CSE students. It includes a secured, authenticated workspace with a Claude-powered tutor, AI quiz generation and scoring, flashcard creation/review, code explanation, Pomodoro tracking, and analytics driven by persisted user activity.

## Key Technologies

- TanStack Start + TanStack Router (file-based routing)
- React 19 + TypeScript (strict mode)
- Tailwind CSS 4 + custom CSS design system
- Netlify Identity (`@netlify/identity`) for authentication
- Netlify Blobs (`@netlify/blobs`) for persistent data storage
- Anthropic Claude API (`@anthropic-ai/sdk`) for AI tutor, quizzes, flashcards, and code explanations
- Netlify deployment integration (`@netlify/vite-plugin-tanstack-start`)

## Features

- Real user authentication (signup/signin/signout)
- Protected application routes (`/app`)
- Live AI tutor with persistent conversation history
- AI-generated quizzes with saved attempts and scoring history
- Manual + AI flashcard system with review tracking
- Code explainer with markdown responses from Claude
- Functional Pomodoro timer with completed session persistence
- Real analytics based on quiz, flashcard, chat, and pomodoro data
- Responsive mobile-first UI and complete dark/light theming

## Run Locally

1. Install dependencies:

```bash
npm install --legacy-peer-deps
```

2. Start development server:

```bash
npm run dev
```

3. For Netlify runtime behavior (recommended for auth/platform features):

```bash
/opt/buildhome/node-deps/node_modules/.bin/netlify dev
```

## Environment

Set these environment variables in Netlify or your local environment as needed:

- `ANTHROPIC_API_KEY`
- `ANTHROPIC_BASE_URL` (optional when using Netlify AI Gateway)
- `ANTHROPIC_MODEL` (optional override, defaults to `claude-haiku-4-5`)
