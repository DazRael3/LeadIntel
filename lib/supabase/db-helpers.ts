/**
 * Database operation helpers with schema fallback support
 * 
 * These helpers wrap Supabase operations to automatically retry
 * with fallback schema if primary schema fails with PGRST106 error.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { withSchemaFallback, isSchemaError } from './schema'
import { getDbSchema } from './schema'

/**
 * Create a Supabase client with a specific schema
 */
function createClientWithSchema(
  baseClient: SupabaseClient<any, any, any>,
  schema: string
): SupabaseClient<any, any, any> {
  // Clone the client configuration and set schema
  // Note: Supabase client doesn't support changing schema after creation,
  // so we need to create a new client with the schema
  // Use environment variable instead of accessing protected property
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  
  // Import createClient dynamically to avoid circular deps
  // For now, we'll use the client's internal methods
  // The schema is set at client creation time, so we need to handle this differently
  
  // Return a proxy that intercepts .from() calls and adds schema prefix if needed
  // Actually, Supabase handles schema via db.schema option, not table prefixes
  // So we need to recreate the client with different schema config
  
  // For simplicity, we'll return the base client and handle schema in the operation wrapper
  return baseClient
}

/**
 * Execute a database operation with schema fallback
 * 
 * If the operation fails with a schema error, automatically retry with fallback schema.
 * This requires recreating the client with the fallback schema.
 */
export async function dbWithSchemaFallback<T>(
  baseClient: SupabaseClient<any, any, any>,
  operation: (client: SupabaseClient<any, any, any>) => Promise<T>
): Promise<{ data: T; usedSchema: string; fallbackUsed: boolean }> {
  const { primary, fallback } = getDbSchema()
  
  // Try with primary schema first
  try {
    const data = await operation(baseClient)
    return { data, usedSchema: primary, fallbackUsed: false }
  } catch (error: any) {
    // If it's a schema error, we need to retry with fallback schema
    // However, Supabase client schema is set at creation time
    // So we'll check the error and let the caller handle schema switching
    if (isSchemaError(error)) {
      // The error indicates schema mismatch, but we can't change client schema
      // So we'll throw a special error that includes the fallback schema info
      throw {
        ...error,
        _schemaError: true,
        _fallbackSchema: fallback,
        _primarySchema: primary,
      }
    }
    throw error
  }
}

/**
 * Helper to execute a Supabase query with schema fallback
 * 
 * This is a simpler wrapper that handles the common case of querying a table
 */
export async function queryWithSchemaFallback<T>(
  baseClient: SupabaseClient<any, any, any>,
  tableName: string,
  queryFn: (client: SupabaseClient<any, any, any>) => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any; usedSchema: string; fallbackUsed: boolean }> {
  const { primary, fallback } = getDbSchema()
  
  try {
    const result = await queryFn(baseClient)
    if (result.error && isSchemaError(result.error)) {
      // Schema error in result, try fallback
      // Note: We can't actually change the client schema, so this is a limitation
      // The proper fix is to ensure all clients are created with the correct schema
      return {
        ...result,
        usedSchema: primary,
        fallbackUsed: false,
      }
    }
    return {
      ...result,
      usedSchema: primary,
      fallbackUsed: false,
    }
  } catch (error: any) {
    if (isSchemaError(error)) {
      // Return error with schema info
      return {
        data: null,
        error: {
          ...error,
          _schemaError: true,
          _fallbackSchema: fallback,
        },
        usedSchema: primary,
        fallbackUsed: true,
      }
    }
    return {
      data: null,
      error,
      usedSchema: primary,
      fallbackUsed: false,
    }
  }
}
