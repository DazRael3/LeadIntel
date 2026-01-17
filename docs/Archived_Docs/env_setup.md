# Environment Variables Setup

## Required Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
# Alternative naming convention (use one or the other)
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key

# Supabase Database Schema Configuration
# PostgREST may expose only 'api' schema, or 'public' schema
# Set primary to match your Supabase configuration
# Default: 'api' (since PostgREST often exposes only 'api')
SUPABASE_DB_SCHEMA=api
SUPABASE_DB_SCHEMA_FALLBACK=public

# Supabase Service Role Key (for admin operations, dev-only)
# Required for /api/dev/create-user endpoint
# Get this from: Supabase Dashboard > Settings > API > service_role key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Development Seed Secret
# Used to protect dev-only endpoints (change in production)
# Set a random string for local development
DEV_SEED_SECRET=dev-secret-change-me

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# Optional: Clearbit API (for company enrichment)
CLEARBIT_API_KEY=your-clearbit-api-key

# Optional: News API (for company news)
NEWS_API_KEY=your-news-api-key

# Stripe Configuration (for Pro subscriptions)
STRIPE_SECRET_KEY=your-stripe-secret-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
# IMPORTANT: Must be a Price ID (starts with price_), NOT a Product ID (prod_)
# Get this from: Stripe Dashboard > Products > [Your Product] > Pricing > Copy Price ID
STRIPE_PRICE_ID=price_xxx
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

# Site URL (for redirects)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Schema Configuration

The app supports automatic schema fallback. If your Supabase PostgREST is configured to expose only the `api` schema (common), set:

```bash
SUPABASE_DB_SCHEMA=api
SUPABASE_DB_SCHEMA_FALLBACK=public
```

If your tables are in the `public` schema, set:

```bash
SUPABASE_DB_SCHEMA=public
SUPABASE_DB_SCHEMA_FALLBACK=api
```

The app will automatically retry with the fallback schema if the primary schema fails with a PGRST106 error.

## Dev User Creation

To create a test user without email verification (dev-only):

```bash
curl -X POST http://localhost:3000/api/dev/create-user \
  -H "Content-Type: application/json" \
  -H "x-dev-secret: dev-secret-change-me" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

This will:
- Create a user with email confirmation bypassed
- Set the user to Pro tier for testing
- Return `{ userId, email, isPro: true }`

**Important**: This endpoint only works in development mode (`NODE_ENV !== 'production'`).
