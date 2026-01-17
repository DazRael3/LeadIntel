/**
 * Schema-aware Supabase client factory with fallback support
 * 
 * This module provides helpers to create Supabase clients with schema configuration
 * and handle schema errors by retrying with fallback schema.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { getDbSchema, isSchemaError } from './schema'

/**
 * Get Supabase anon key - supports both env var naming conventions
 */
function getSupabaseKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  )
}

/**
 * Create a route client with a specific schema
 */
function createRouteClientWithSchema(
  request: NextRequest,
  response: NextResponse,
  schema: string
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = getSupabaseKey()

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    db: {
      schema,
    },
    cookies: {
      getAll() {
        return request.cookies.getAll().map(cookie => ({
          name: cookie.name,
          value: cookie.value,
        }))
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options as CookieOptions)
        })
      },
    },
  })
}

/**
 * Execute a database operation with automatic schema fallback
 * 
 * If the operation fails with a schema error, automatically retry with fallback schema.
 */
export async function withSchemaFallbackOperation<T>(
  request: NextRequest,
  bridge: NextResponse,
  operation: (client: ReturnType<typeof createRouteClientWithSchema>) => Promise<T>
): Promise<{ data: T; usedSchema: string; fallbackUsed: boolean }> {
  const { primary, fallback } = getDbSchema()
  
  // Try with primary schema first
  try {
    const client = createRouteClientWithSchema(request, bridge, primary)
    const data = await operation(client)
    return { data, usedSchema: primary, fallbackUsed: false }
  } catch (error: any) {
    // Check if it's a schema error
    if (isSchemaError(error)) {
      // Retry with fallback schema
      try {
        const fallbackClient = createRouteClientWithSchema(request, bridge, fallback)
        const data = await operation(fallbackClient)
        return { data, usedSchema: fallback, fallbackUsed: true }
      } catch (fallbackError: any) {
        // If fallback also fails, throw original error
        throw error
      }
    }
    // If it's not a schema error, throw it as-is
    throw error
  }
}

/**
 * Execute a Supabase query with schema fallback
 * 
 * Wraps a Supabase query operation and automatically retries with fallback schema
 * if the primary schema fails with a schema error.
 */
export async function queryWithSchemaFallback<T>(
  request: NextRequest,
  bridge: NextResponse,
  queryFn: (client: ReturnType<typeof createRouteClientWithSchema>) => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any; usedSchema: string; fallbackUsed: boolean }> {
  const { primary, fallback } = getDbSchema()
  
  // Try with primary schema
  const primaryClient = createRouteClientWithSchema(request, bridge, primary)
  const primaryResult = await queryFn(primaryClient)
  
  // Check if error is schema-related
  if (primaryResult.error && isSchemaError(primaryResult.error)) {
    // Retry with fallback schema
    try {
      const fallbackClient = createRouteClientWithSchema(request, bridge, fallback)
      const fallbackResult = await queryFn(fallbackClient)
      return {
        ...fallbackResult,
        usedSchema: fallback,
        fallbackUsed: true,
      }
    } catch (fallbackError: any) {
      // If fallback fails, return primary error
      return {
        ...primaryResult,
        usedSchema: primary,
        fallbackUsed: false,
      }
    }
  }
  
  return {
    ...primaryResult,
    usedSchema: primary,
    fallbackUsed: false,
  }
}
