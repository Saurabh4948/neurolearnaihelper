import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  getUser,
  handleAuthCallback,
  logout,
  onAuthChange,
  type User,
} from '@netlify/identity'

interface IdentityContextValue {
  user: User | null
  ready: boolean
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const IdentityContext = createContext<IdentityContextValue | null>(null)

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function initialize() {
      try {
        await handleAuthCallback()
      } catch {
        // callback hash is optional; ignore callback errors and continue
      }

      const currentUser = await getUser()
      setUser(currentUser ?? null)
      setReady(true)
    }

    initialize()
    const unsubscribe = onAuthChange((_event, nextUser) => {
      setUser(nextUser ?? null)
    })

    return unsubscribe
  }, [])

  const value = useMemo<IdentityContextValue>(
    () => ({
      user,
      ready,
      signOut: logout,
      refresh: async () => {
        const nextUser = await getUser()
        setUser(nextUser ?? null)
      },
    }),
    [ready, user],
  )

  return (
    <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>
  )
}

export function useIdentity() {
  const context = useContext(IdentityContext)
  if (!context) {
    throw new Error('useIdentity must be used within IdentityProvider')
  }

  return context
}
