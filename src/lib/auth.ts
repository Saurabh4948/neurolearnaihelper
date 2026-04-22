import { getUser } from '@netlify/identity'
import { createServerFn } from '@tanstack/react-start'

export interface AuthUser {
  id: string
  email: string
}

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await getUser()
    if (!user?.id || !user.email) {
      return null
    }

    return {
      id: user.id,
      email: user.email,
    } satisfies AuthUser
  },
)
