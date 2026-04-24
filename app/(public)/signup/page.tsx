import type { Metadata } from 'next'
import React from 'react'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { LoginClient } from '../login/LoginClient'
import { JsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Sign up | LeadIntel',
  description: 'Create a LeadIntel account.',
  alternates: { canonical: 'https://dazrael.com/signup' },
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
  const redirectTo = sp.redirect ?? '/onboarding'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'LeadIntel Signup',
    url: 'https://dazrael.com/signup',
    description: 'Create your LeadIntel account to unlock full lead results and campaign automation.',
  }
  return (
    <>
      <JsonLd data={jsonLd} />
      <MarketingPage title="Sign up" subtitle="Create your LeadIntel account.">
        <LoginClient initialMode="signup" redirectTo={redirectTo} />
      </MarketingPage>
    </>
  )
}

