/**
 * Schema configuration for Supabase database access
 * 
 * Supabase PostgREST can expose different schemas. This helper provides
 * a canonical way to configure which schema to use, with fallback support.
 * 
 * Environment variables:
 * - NEXT_PUBLIC_SUPABASE_DB_SCHEMA or SUPABASE_DB_SCHEMA: Primary schema (default: 'api')
 * - SUPABASE_DB_SCHEMA_FALLBACK: Fallback schema (default: 'api' for consistency)
 */

export interface SchemaConfig {
  primary: string
  fallback: string
}

/**
 * Get the database schema configuration from environment variables
 * Defaults to 'public' as primary (standard Supabase schema)
 * with 'api' as fallback for compatibility
 */
export function getDbSchema(): SchemaConfig {
  const primary =
    process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA ||
    process.env.SUPABASE_DB_SCHEMA ||
    'api'
  const fallback = process.env.SUPABASE_DB_SCHEMA_FALLBACK || 'api'
  
  return { primary, fallback }
}

/**
 * Check if an error is a schema-related error (PGRST106 or similar)
 */
export function isSchemaError(error: unknown): boolean {
  if (!error) return false
  
  const errorObj = error as { message?: unknown; code?: unknown }
  const errorMessage = String(errorObj.message ?? error).toLowerCase()
  const errorCode = String(errorObj.code ?? '').toLowerCase()
  
  return (
    errorCode.includes('pgrst106') ||
    errorMessage.includes('invalid schema') ||
    (errorMessage.includes('schema') && errorMessage.includes('not exposed')) ||
    errorMessage.includes('only the following schemas are exposed')
  )
}

/**
 * Execute an operation with schema fallback retry
 * 
 * If the operation fails with a schema error, automatically retry with fallback schema.
 * 
 * @param op - Function that takes a schema name and returns a promise
 * @returns Result with metadata about which schema was used
 */
export async function withSchemaFallback<T>(
  op: (schema: string) => Promise<T>
): Promise<{ data: T; usedSchema: string; fallbackUsed: boolean }> {
  const { primary, fallback } = getDbSchema()
  
  try {
    const data = await op(primary)
    return { data, usedSchema: primary, fallbackUsed: false }
  } catch (error: unknown) {
    // If it's a schema error and we haven't tried fallback yet, retry
    if (isSchemaError(error)) {
      try {
        const data = await op(fallback)
        return { data, usedSchema: fallback, fallbackUsed: true }
      } catch {
        // If fallback also fails, throw the original error
        throw error
      }
    }
    // If it's not a schema error, throw it as-is
    throw error
  }
}
