import { NextResponse } from 'next/server'

/**
 * Creates a JSON response and forwards Set-Cookie headers from a cookie source response.
 * 
 * This is essential for Route Handlers that use Supabase cookie bridging:
 * 1. Create a bridge response: const bridge = NextResponse.next()
 * 2. Pass bridge to createRouteClient(req, bridge)
 * 3. Call supabase.auth.getUser() (sets cookies on bridge)
 * 4. Use jsonWithCookies() to return final response with cookies preserved
 * 
 * @param payload - The JSON payload to return
 * @param options - Response options (status, headers, etc.)
 * @param cookieSourceResponse - The response object that has Set-Cookie headers to forward
 * @returns NextResponse with JSON body and forwarded cookies
 */
export function jsonWithCookies(
  payload: any,
  options: { status?: number; headers?: HeadersInit } = {},
  cookieSourceResponse?: NextResponse
): NextResponse {
  const response = NextResponse.json(payload, options)

  // Forward all Set-Cookie headers from the cookie source response
  if (cookieSourceResponse) {
    // Get all Set-Cookie headers from the source response
    const setCookieHeaders: string[] = []
    
    // Iterate through all headers to find Set-Cookie headers
    cookieSourceResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        setCookieHeaders.push(value)
      }
    })

    // Add all Set-Cookie headers to the final response
    setCookieHeaders.forEach(cookieValue => {
      response.headers.append('Set-Cookie', cookieValue)
    })
  }

  return response
}
