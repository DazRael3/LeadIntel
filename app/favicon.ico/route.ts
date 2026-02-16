import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-static'

// Dev-friendly favicon: redirect to the SVG favicon so browsers don't 404 /favicon.ico.
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/favicon.svg', request.url))
}

