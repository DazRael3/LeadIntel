# Free AI Provider Setup (LeadIntel)

This guide configures LeadIntel to use free/low-cost AI providers first, with safe fallbacks and OpenAI disabled by default.

## Provider Priority

LeadIntel provider router order (recommended default):

1. Gemini
2. Groq
3. Cloudflare Workers AI
4. Hugging Face Inference
5. Template fallback
6. OpenAI (only when explicitly enabled)

## Environment Variables

Use these values in local `.env.local` and in Vercel environment settings:

```bash
AI_PROVIDER_ORDER=gemini,groq,cloudflare,huggingface,template
AI_DISABLE_OPENAI=true
AI_FREE_MODE=true
AI_REQUEST_TIMEOUT_MS=15000
AI_MAX_RETRIES=1
AI_DAILY_GLOBAL_LIMIT=1000
AI_DAILY_USER_LIMIT=25

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile

CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_WORKERS_AI_MODEL=@cf/meta/llama-3.1-8b-instruct

HUGGINGFACE_API_KEY=
HUGGINGFACE_MODEL=mistralai/Mistral-7B-Instruct-v0.3

TAVILY_API_KEY=
SERPAPI_API_KEY=

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

## How to Get Provider Credentials

### Gemini

1. Go to Google AI Studio.
2. Create an API key.
3. Set `GEMINI_API_KEY`.

### Groq

1. Go to Groq Console.
2. Create an API key.
3. Set `GROQ_API_KEY`.

### Cloudflare Workers AI

1. Open Cloudflare dashboard.
2. Copy account ID.
3. Create API token with Workers AI permissions.
4. Set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.

### Hugging Face

1. Open Hugging Face settings.
2. Create an access token for inference.
3. Set `HUGGINGFACE_API_KEY`.

### Tavily (Web Research)

1. Create Tavily API key.
2. Set `TAVILY_API_KEY`.

### SerpAPI (Secondary Web Research)

1. Create SerpAPI key.
2. Set `SERPAPI_API_KEY`.

## Keep OpenAI Disabled by Default

Keep this setting unless you explicitly need OpenAI fallback:

```bash
AI_DISABLE_OPENAI=true
```

If you enable OpenAI:

```bash
AI_DISABLE_OPENAI=false
OPENAI_API_KEY=...
```

## Vercel Setup

1. Open project settings -> Environment Variables.
2. Add all AI provider variables for each deployment environment (Production/Preview/Development as needed).
3. Do **not** put secret keys in `NEXT_PUBLIC_*` variables.
4. Redeploy after updating env vars.

## Local `.env.local` Setup

1. Copy from `.env.example`.
2. Fill provider keys you want to enable.
3. Keep `AI_DISABLE_OPENAI=true` unless intentionally enabling OpenAI.
4. Restart local dev server after env updates.

## Run Provider Diagnostics

Use:

```bash
npm run check:ai-providers
```

This prints:

- configured providers (without printing keys)
- provider order
- whether OpenAI is disabled
- per-provider tiny prompt health check
- quota/cache availability

## Key Rotation

1. Generate a new key in provider dashboard.
2. Update Vercel + local env values.
3. Revoke old key.
4. Run `npm run check:ai-providers` to verify.

## Safety Notes

- Free tiers can rate-limit unexpectedly.
- LeadIntel uses automatic failover and deterministic template fallback.
- Prompt redaction is applied before external model calls.
- Never include customer secrets, tokens, or raw auth data in prompts.
- Free-tier providers are not guaranteed for high production volume; plan paid capacity for strict SLAs.
