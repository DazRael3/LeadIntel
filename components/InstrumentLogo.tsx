'use client'

import { useMemo, useState } from 'react'

export function InstrumentLogo(props: { symbol: string; logoUrl?: string | null; size?: number; className?: string }) {
  const size = props.size ?? 20
  const [failed, setFailed] = useState(false)

  const letter = useMemo(() => {
    const s = (props.symbol || '?').trim()
    return (s[0] || '?').toUpperCase()
  }, [props.symbol])

  const showImage = Boolean(props.logoUrl) && !failed

  if (!showImage) {
    return (
      <div
        className={`grid place-items-center rounded-md border border-cyan-500/15 bg-background/30 text-[10px] font-semibold text-cyan-200 ${props.className ?? ''}`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        {letter}
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- External logos are best-effort; Next Image config is not guaranteed here.
    <img
      src={props.logoUrl as string}
      alt={`${props.symbol} logo`}
      width={size}
      height={size}
      className={`rounded-md border border-cyan-500/10 bg-background/30 object-contain ${props.className ?? ''}`}
      onError={() => setFailed(true)}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  )
}

