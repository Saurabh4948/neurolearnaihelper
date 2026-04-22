import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'

import { IdentityProvider } from '@/lib/identity-context'
import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'StudyMind AI' },
      {
        name: 'description',
        content:
          'StudyMind AI is a production-grade study assistant for CSE students with AI tutoring, quizzes, flashcards, code explanations, pomodoro, and analytics.',
      },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <IdentityProvider>
          <Outlet />
        </IdentityProvider>
        <Scripts />
      </body>
    </html>
  )
}
