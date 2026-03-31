import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = (searchParams.get('title') || 'LeadIntel').trim().slice(0, 80)
  const subtitle = (searchParams.get('subtitle') || 'Trigger-based alerts → instant pitches').trim().slice(0, 120)
  const host = (() => {
    try {
      return new URL(request.url).hostname
    } catch {
      return 'leadintel.com'
    }
  })()

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          backgroundColor: '#050a14',
          color: '#e5e7eb',
          padding: '56px',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(34,211,238,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.10) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            opacity: 0.25,
          }}
        />

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 22, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#22d3ee', letterSpacing: 0.2 }}>LeadIntel</div>
            <div
              style={{
                fontSize: 14,
                color: '#94a3b8',
                border: '1px solid rgba(34,211,238,0.25)',
                padding: '8px 12px',
                borderRadius: 999,
              }}
            >
              {host}
            </div>
          </div>

          <div
            style={{
              border: '1px solid rgba(34,211,238,0.25)',
              borderRadius: 20,
              background: 'rgba(2,6,23,0.75)',
              padding: 34,
              boxShadow: '0 0 60px rgba(34,211,238,0.08)',
            }}
          >
            <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 14, letterSpacing: 1.2 }}>
              TERMINAL BRIEF
            </div>
            <div style={{ fontSize: 58, fontWeight: 800, lineHeight: 1.05 }}>{title}</div>
            <div style={{ marginTop: 18, fontSize: 22, color: '#cbd5e1', lineHeight: 1.35 }}>{subtitle}</div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            <div
              style={{
                border: '1px solid rgba(168,85,247,0.30)',
                background: 'rgba(168,85,247,0.10)',
                color: '#e9d5ff',
                padding: '10px 14px',
                borderRadius: 999,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              Trigger signals
            </div>
            <div
              style={{
                border: '1px solid rgba(34,211,238,0.30)',
                background: 'rgba(34,211,238,0.10)',
                color: '#a5f3fc',
                padding: '10px 14px',
                borderRadius: 999,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              0–100 score
            </div>
            <div
              style={{
                border: '1px solid rgba(16,185,129,0.30)',
                background: 'rgba(16,185,129,0.10)',
                color: '#bbf7d0',
                padding: '10px 14px',
                borderRadius: 999,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              Send-ready outreach
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}

