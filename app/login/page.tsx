import { LoginClient } from './LoginClient'

interface LoginPageProps {
  searchParams?: {
    mode?: string
    redirect?: string
  }
}

export default function LoginPage({ searchParams = {} }: LoginPageProps) {
  // Read mode from searchParams (default: 'signin')
  const initialMode = searchParams?.mode === 'signup' ? 'signup' : 'signin'
  
  // Read redirect from searchParams (default: '/dashboard')
  const redirectTo = searchParams?.redirect ?? '/dashboard'

  return <LoginClient initialMode={initialMode} redirectTo={redirectTo} />
}
