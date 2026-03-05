import type { Page } from '@playwright/test'

export function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v || v.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return v.trim()
}

export async function setE2ECookies(args: {
  page: Page
  baseURL: string
  authed?: boolean
  plan?: 'free' | 'pro' | 'closer_plus' | 'team'
  uid?: string
  email?: string
}): Promise<void> {
  const cookies: Array<{ name: string; value: string; url: string }> = []
  if (args.authed) cookies.push({ name: 'li_e2e_auth', value: '1', url: args.baseURL })
  if (args.plan) cookies.push({ name: 'li_e2e_plan', value: args.plan, url: args.baseURL })
  if (args.uid) cookies.push({ name: 'li_e2e_uid', value: args.uid, url: args.baseURL })
  if (args.email) cookies.push({ name: 'li_e2e_email', value: args.email, url: args.baseURL })
  if (cookies.length > 0) await args.page.context().addCookies(cookies)
}

export async function loginViaUi(args: { page: Page; email: string; password: string }): Promise<void> {
  await args.page.goto(`/login?mode=signin&redirect=${encodeURIComponent('/dashboard')}`)
  await args.page.getByTestId('login-email').fill(args.email)
  await args.page.getByTestId('login-password').fill(args.password)
  await args.page.getByTestId('login-submit').click()
}

