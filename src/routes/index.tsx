import { Link, createFileRoute } from '@tanstack/react-router'

import { getCurrentUser } from '@/lib/auth'

export const Route = createFileRoute('/')({
  loader: async () => ({ user: await getCurrentUser() }),
  component: HomePage,
})

function HomePage() {
  const { user } = Route.useLoaderData()

  return (
    <main className="landing-page">
      <div className="landing-glow" aria-hidden="true" />
      <header className="landing-header">
        <div className="brand">StudyMind AI</div>
        <div className="landing-actions">
          {user ? (
            <Link className="button solid" to="/app">
              Open Dashboard
            </Link>
          ) : (
            <Link className="button solid" to="/auth">
              Get Started
            </Link>
          )}
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">CSE Daily Study Stack</p>
        <h1>Study smarter with a real AI tutor and measurable progress.</h1>
        <p>
          StudyMind AI combines Claude-powered tutoring, quiz drills,
          flashcards, code explanations, focus sessions, and real analytics in
          one secured workspace.
        </p>
        <div className="hero-cta">
          <Link className="button solid" to={user ? '/app' : '/auth'}>
            {user ? 'Continue Studying' : 'Create Account'}
          </Link>
          <Link className="button ghost" to="/auth">
            Sign In
          </Link>
        </div>
      </section>

      <section className="feature-grid">
        <article className="feature-card">
          <h2>Live AI Tutor</h2>
          <p>Ask DSA, OS, DBMS, CN, and interview prep questions instantly.</p>
        </article>
        <article className="feature-card">
          <h2>Quiz Engine</h2>
          <p>
            Generate topic-focused quizzes with difficulty controls and track
            scores over time.
          </p>
        </article>
        <article className="feature-card">
          <h2>Flashcards + Pomodoro</h2>
          <p>
            Review key concepts with spaced repetition while logging deep-focus
            sessions.
          </p>
        </article>
      </section>
    </main>
  )
}
