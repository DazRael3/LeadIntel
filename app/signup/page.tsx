import { LoginClient } from '../login/LoginClient'

interface SignupPageProps {
  searchParams?: {
    redirect?: string
  }
}

export default function SignupPage({ searchParams = {} }: SignupPageProps) {
  const redirectTo = searchParams?.redirect ?? '/dashboard'
  return <LoginClient initialMode="signup" redirectTo={redirectTo} />
}

