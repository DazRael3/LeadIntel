import type { Metadata } from 'next'
import React from 'react'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { LoginClient } from './LoginClient'

export const metadata: Metadata = {
  title: 'Log in | LeadIntel',
  description: 'Log in to your LeadIntel account.',
  alternates: { canonical: 'https://raelinfo.com/login' },
  openGraph: {
    title: 'Log in | LeadIntel',
    description: 'Log in to your LeadIntel account.',
    url: 'https://raelinfo.com/login',
  },
}

interface LoginPageProps {
  searchParams?: Promise<{
    mode?: string
    redirect?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = (await searchParams) ?? {}
  // Read mode from searchParams (default: 'signin')
  const initialMode = sp.mode === 'signup' ? 'signup' : 'signin'
  
  // Read redirect from searchParams (default: '/dashboard')
  const redirectTo = sp.redirect ?? '/dashboard'

  const title = initialMode === 'signup' ? 'Sign up' : 'Log in'
  const subtitle = initialMode === 'signup' ? 'Create your LeadIntel account.' : 'Access your LeadIntel workspace.'

  return (
    <MarketingPage title={title} subtitle={subtitle}>
      <LoginClient initialMode={initialMode} redirectTo={redirectTo} />
    </MarketingPage>
  )
}
