import { useMemo, useState, type FormEvent } from 'react'
import {
  AuthError,
  MissingIdentityError,
  getUser,
  login,
  signup,
} from '@netlify/identity'
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'

import { getCurrentUser } from '@/lib/auth'
import { useIdentity } from '@/lib/identity-context'

export const Route = createFileRoute('/auth')({
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (user) {
      throw redirect({ to: '/app' })
    }
  },
  component: AuthPage,
})

interface FormState {
  fullName: string
  email: string
  password: string
}

const initialState: FormState = {
  fullName: '',
  email: '',
  password: '',
}

function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [form, setForm] = useState<FormState>(initialState)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { refresh } = useIdentity()

  const canSubmit = useMemo(() => {
    if (!form.email.trim() || !form.password.trim()) {
      return false
    }
    if (mode === 'signup' && !form.fullName.trim()) {
      return false
    }
    return true
  }, [form, mode])

  const validate = () => {
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      return 'Enter a valid email address.'
    }

    if (form.password.length < 8) {
      return 'Password must be at least 8 characters.'
    }

    if (mode === 'signup' && form.fullName.trim().length < 2) {
      return 'Full name must be at least 2 characters.'
    }

    return ''
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)

    try {
      if (mode === 'signin') {
        await login(form.email.trim(), form.password)
      } else {
        await signup(form.email.trim(), form.password, {
          full_name: form.fullName.trim(),
        })

        const signedInUser = await getUser()
        if (!signedInUser) {
          setSuccess('Account created. Verify email from your inbox, then sign in.')
          setMode('signin')
          setIsLoading(false)
          return
        }
      }

      await refresh()
      await navigate({ to: '/app' })
    } catch (submissionError) {
      if (submissionError instanceof MissingIdentityError) {
        setError('Netlify Identity is not enabled for this deploy environment.')
      } else if (submissionError instanceof AuthError) {
        switch (submissionError.status) {
          case 401:
            setError('Invalid email or password.')
            break
          case 403:
            setError('Signups are disabled for this site.')
            break
          case 422:
            setError('Please review your inputs and try again.')
            break
          default:
            setError(submissionError.message)
        }
      } else {
        setError('Unable to complete authentication. Please retry.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-panel">
        <div className="auth-head">
          <Link to="/" className="brand">
            StudyMind AI
          </Link>
          <p>
            {mode === 'signin'
              ? 'Sign in to access your protected study workspace.'
              : 'Create your account to start learning with Claude.'}
          </p>
        </div>

        <div className="mode-toggle" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={`segmented ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => {
              setMode('signin')
              setError('')
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={`segmented ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setMode('signup')
              setError('')
            }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={onSubmit} className="auth-form" noValidate>
          {mode === 'signup' && (
            <label>
              Full Name
              <input
                value={form.fullName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    fullName: event.target.value,
                  }))
                }
                placeholder="Aarav Rao"
                minLength={2}
                required
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              placeholder="student@campus.edu"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder="Minimum 8 characters"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={8}
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          {success ? <p className="form-success">{success}</p> : null}

          <button className="button solid" type="submit" disabled={isLoading || !canSubmit}>
            {isLoading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </main>
  )
}
