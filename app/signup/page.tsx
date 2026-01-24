import { redirect } from 'next/navigation'

interface SignupPageProps {
  searchParams?: {
    redirect?: string
  }
}

/**
 * Convenience route: `/signup`
 * The app’s auth UI is implemented at `/login` with `mode=signup`.
 */
export default function SignupPage({ searchParams = {} }: SignupPageProps) {
  const redirectTo = searchParams?.redirect ?? '/dashboard'
  redirect(`/login?mode=signup&redirect=${encodeURIComponent(redirectTo)}`)
}

