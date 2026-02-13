import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { LoginForm } from '../components/login-form'

export function Login() {
  const { session, loading, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && session) {
      navigate('/', { replace: true })
    }
  }, [loading, session, navigate])

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <LoginForm onGoogle={() => void signInWithGoogle()} disabled={loading} />
      </div>
    </div>
  )
}
