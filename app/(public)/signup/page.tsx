import type { Metadata } from 'next'
import { LoginClient } from '../login/LoginClient'

export const metadata: Metadata = {
  title: 'Sign up | LeadIntel',
  description: 'Create a LeadIntel account.',
  openGraph: {
    title: 'Sign up | LeadIntel',
    description: 'Create a LeadIntel account.',
    url: 'https://dazrael.com/signup',
  },
}

interface SignupPageProps {
  searchParams?: Promise<{
    redirect?: string
  }>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const sp = (await searchParams) ?? {}
  const redirectTo = sp.redirect ?? '/dashboard'
  return <LoginClient initialMode="signup" redirectTo={redirectTo} />
}

