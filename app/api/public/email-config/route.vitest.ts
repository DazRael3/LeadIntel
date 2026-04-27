import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const domainsListMock = vi.fn()
const resendCtorMock = vi.fn(function thisResendMock(this: unknown) {
  return {
    domains: {
      list: domainsListMock,
    },
  }
})

vi.mock('resend', () => ({
  Resend: resendCtorMock,
}))

describe('/api/public/email-config', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.RESEND_API_KEY
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  it('returns 200 enabled:false when RESEND_API_KEY is missing', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://raelinfo.com'

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost:3000/api/public/email-config'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data).toEqual({ enabled: false })
    expect(resendCtorMock).not.toHaveBeenCalled()
  })

  it('returns 200 enabled:false when site URL is invalid', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.NEXT_PUBLIC_SITE_URL = 'not a valid url'

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost:3000/api/public/email-config'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data).toEqual({ enabled: false })
    expect(resendCtorMock).not.toHaveBeenCalled()
  })

  it('returns 200 enabled:false when Resend domains API fails', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://raelinfo.com'
    domainsListMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'upstream failure' },
    })

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost:3000/api/public/email-config'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data).toEqual({ enabled: false })
  })

  it('returns 200 enabled:false when Resend domains.list throws', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://raelinfo.com'
    domainsListMock.mockRejectedValueOnce(new Error('network down'))

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost:3000/api/public/email-config'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data).toEqual({ enabled: false })
  })

  it('returns 200 enabled:true when matching domain is verified for sending', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.raelinfo.com'
    domainsListMock.mockResolvedValueOnce({
      data: {
        object: 'list',
        has_more: false,
        data: [
          {
            id: 'dom_1',
            name: 'raelinfo.com',
            status: 'verified',
            capabilities: { sending: 'enabled', receiving: 'disabled' },
          },
        ],
      },
      error: null,
    })

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost:3000/api/public/email-config'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data).toEqual({ enabled: true })
  })
})
