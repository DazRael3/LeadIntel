'use client'

type PixelEventName = 'view_content' | 'initiate_checkout' | 'purchase'

type FbqCallable = ((command: 'init' | 'track' | 'trackCustom', event: string, params?: Record<string, unknown>) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue?: unknown[][]
  push?: (...args: unknown[]) => number
  loaded?: boolean
  version?: string
}

type TikTokCallable = {
  track?: (event: string, props?: Record<string, unknown>) => void
  page?: () => void
}

type PixelWindow = Window & {
  fbq?: FbqCallable
  _fbq?: FbqCallable
  ttq?: TikTokCallable
  __leadIntelPixelsReady?: boolean
}

const META_EVENT_MAP: Record<PixelEventName, string> = {
  view_content: 'ViewContent',
  initiate_checkout: 'InitiateCheckout',
  purchase: 'Purchase',
}

const TIKTOK_EVENT_MAP: Record<PixelEventName, string> = {
  view_content: 'ViewContent',
  initiate_checkout: 'InitiateCheckout',
  purchase: 'CompletePayment',
}

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function analyticsEnabled(): boolean {
  const enabled = (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED ?? '').trim().toLowerCase()
  return enabled === '1' || enabled === 'true'
}

function getMetaPixelId(): string | null {
  const raw = (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '').trim()
  return raw.length > 0 ? raw : null
}

function getTikTokPixelId(): string | null {
  const raw = (process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID ?? '').trim()
  return raw.length > 0 ? raw : null
}

function injectScriptOnce(id: string, code: string): void {
  if (!isClient()) return
  if (document.getElementById(id)) return
  const script = document.createElement('script')
  script.id = id
  script.async = true
  script.text = code
  document.head.appendChild(script)
}

function initMetaPixel(pixelId: string): void {
  injectScriptOnce(
    'leadintel-meta-pixel',
    `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];if(s&&s.parentNode){s.parentNode.insertBefore(t,s)}}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');`
  )

  const win = window as PixelWindow
  if (typeof win.fbq === 'function') {
    win.fbq('init', pixelId)
    win.fbq('track', 'PageView')
  }
}

function initTikTokPixel(pixelId: string): void {
  injectScriptOnce(
    'leadintel-tiktok-pixel',
    `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=['page','track'];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var n='https://analytics.tiktok.com/i18n/pixel/events.js';var a=d.createElement('script');a.type='text/javascript';a.async=!0;a.src=n+'?sdkid='+e+'&lib='+t;var s=d.getElementsByTagName('script')[0];if(s&&s.parentNode){s.parentNode.insertBefore(a,s)}};ttq.load('${pixelId}');ttq.page();}(window, document, 'ttq');`
  )
}

function mapPixelEvent(eventName: string): PixelEventName | null {
  if (eventName === 'page_view' || eventName === 'results_viewed' || eventName === 'view_content') return 'view_content'
  if (eventName === 'checkout_started') return 'initiate_checkout'
  if (eventName === 'payment_completed' || eventName === 'purchase') return 'purchase'
  return null
}

export function initTrackingPixels(): void {
  if (!isClient()) return
  if (!analyticsEnabled()) return
  const win = window as PixelWindow
  if (win.__leadIntelPixelsReady) return

  const metaPixelId = getMetaPixelId()
  const tikTokPixelId = getTikTokPixelId()

  if (metaPixelId) initMetaPixel(metaPixelId)
  if (tikTokPixelId) initTikTokPixel(tikTokPixelId)

  win.__leadIntelPixelsReady = true
}

export function trackRetargetingPixels(eventName: string, props?: Record<string, unknown>): void {
  if (!isClient()) return
  const pixelEvent = mapPixelEvent(eventName)
  if (!pixelEvent) return

  const win = window as PixelWindow
  const metaEvent = META_EVENT_MAP[pixelEvent]
  if (typeof win.fbq === 'function') {
    win.fbq('track', metaEvent, props)
    win.fbq('trackCustom', pixelEvent, props)
  }

  const tikTok = win.ttq as TikTokCallable | undefined
  if (tikTok && typeof tikTok.track === 'function') {
    tikTok.track(TIKTOK_EVENT_MAP[pixelEvent], props)
    tikTok.track(pixelEvent, props)
  }
}
