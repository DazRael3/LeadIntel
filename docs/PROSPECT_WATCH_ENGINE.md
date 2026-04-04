# Prospect watch engine (production-safe, review-first)

LeadIntel’s prospect watch engine is a **founder-usable**, **review-first** system:
- identify likely customers from a workspace target list
- detect “why now” signals from **approved sources** (RSS feeds + manual)
- score and rank prospects
- generate outreach + LinkedIn drafts for **human review**
- send internal/founder digests via Resend
- keep external sending **disabled by default**

## Where it appears

- Prospect queue: `/settings/prospects`
- Content drafts: `/settings/content`

Both surfaces are **Team-gated** and require workspace membership role:
- `owner` / `admin` / `manager`

## Data model (api schema)

Tables (workspace-scoped):
- `api.prospect_watch_targets` — the watch list (company + ICP fit)
- `api.prospect_watch_signals` — detected signals (source URL + type + confidence)
- `api.prospect_watch_scores` — score breakdown + reasons
- `api.prospect_watch_prospects` — review queue status (new/reviewed/approved/rejected/sent/archived)
- `api.prospect_watch_outreach_drafts` — outreach drafts (email/follow_up/linkedin_dm/call_opener)
- `api.prospect_watch_content_drafts` — LinkedIn post drafts

Migration:
- `supabase/migrations/0072_prospect_watch_engine.sql`

## Approved ingestion

### Sources
This engine only ingests from approved inputs:
- **manual targets** added in `/settings/prospects`
- **RSS feeds** provided via env `PROSPECT_WATCH_RSS_FEEDS`

It does **not** scrape LinkedIn or other platforms in ways likely to violate terms.

### Signal types
Signals are classified conservatively:
- hiring
- funding
- product launch
- partnership
- expansion
- leadership hire
- stack change (hint only)
- other

Each signal stores:
- source URL
- title/snippet
- detected type
- confidence
- timestamps (when available)

## Scoring model (simple + explainable)

Scores are 0–100 with clear reasons:
- ICP fit (manual per target)
- signal strength (by type)
- urgency (freshness)
- confidence (classifier confidence)

Weighted overall:
- ICP fit 40%
- signal strength 30%
- urgency 20%
- confidence 10%

## Draft generation (review-only)

Drafts are deterministic templates grounded in the stored signal title/snippet:
- cold email + follow-up
- LinkedIn DM
- short call opener
- LinkedIn post draft (angle + body + CTA)

No external sending happens automatically.

## Contact → recipient review → send-ready

Prospect watch now supports a minimal contact workflow layer so drafts can become **send-ready** without auto-sending.

### Contact candidates

Stored in:
- `api.prospect_watch_contacts`

Allowed sources (review-first):
- `manual` (primary in-product workflow)
- `csv` (future; not enabled by default)
- `provider` (future; only if a real provider is integrated)
- `pattern` (future; must remain clearly unverified)

Email status meanings:
- `unknown`: no email or unknown validity
- `candidate`: provided/guessed but **not verified**
- `verified`: verified by a real provider (not implemented by default)
- `invalid`: known bad
- `manually_confirmed`: human reviewed and approved for sending

### Send-ready rules (outreach drafts)

Send-ready state is tracked on `api.prospect_watch_outreach_drafts`:
- `contact_id`
- `recipient_reviewed` (+ timestamps)
- `send_ready` (+ timestamps)

Rules:
- A draft cannot be marked **send-ready** unless:
  - a contact is selected, and
  - the contact has a real email, and
  - `email_status` is `verified` or `manually_confirmed`
- Marking send-ready mirrors `to_email` from the selected contact.
- Send-ready does **not** send anything externally.

## Founder digests + notifications (Resend)

### Daily digest
Job: `prospect_watch_digest`
- summarizes review-needed counts
- includes links to review queues
- deduped by day+recipient via `api.email_send_log`

### High priority notifications
Optional during ingestion/scoring:
- controlled by env + threshold
- deduped per prospect+recipient

## Cron jobs

Use the existing cron endpoint:
- `GET /api/cron/run?job=prospect_watch`
- `GET /api/cron/run?job=prospect_watch_digest`

Auth:
- `Authorization: Bearer $CRON_SECRET` (or `EXTERNAL_CRON_SECRET`)

Recommended schedule (safe default):
- 2× daily `prospect_watch` (ingest + score + drafts)
- 2× daily `prospect_watch_digest`

## Environment variables

Core:
- `PROSPECT_WATCH_ENABLED=1`
- `PROSPECT_WATCH_RSS_FEEDS="https://example.com/feed.xml,https://another.com/rss"`

Internal review recipients:
- `PROSPECT_WATCH_REVIEW_EMAILS="leadintel@dazrael.com"` (recommended)

Digests / notifications:
- `PROSPECT_WATCH_DAILY_DIGEST_ENABLED=1` (default **disabled**; enable after routing is configured)
- `PROSPECT_WATCH_CONTENT_DIGEST_ENABLED=1` (default **disabled**; enable after routing is configured)
- `PROSPECT_WATCH_HIGH_PRIORITY_ENABLED=0|1`
- `PROSPECT_WATCH_HIGH_PRIORITY_THRESHOLD=92` (default 92)

Email delivery:
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO_EMAIL` (recommended; defaults to `leadintel@dazrael.com`)

## Production routing (recommended values)

Founder/operator review is intended to run through:
- **Inbox**: `leadintel@dazrael.com`
- **Queues**: `/settings/prospects` and `/settings/content`

Recommended env:
- `PROSPECT_WATCH_REVIEW_EMAILS="leadintel@dazrael.com"`

External sending (disabled by default):
- `PROSPECT_WATCH_EXTERNAL_SEND_ENABLED=0|1` (default 0)

## Migration notes

- `0072_prospect_watch_engine.sql` enforces draft uniqueness for safe upserts:
  - `prospect_watch_outreach_drafts` unique `(prospect_id, channel)`
  - `prospect_watch_content_drafts` unique `(prospect_id, kind)`

## What’s intentionally deferred

- Any automatic LinkedIn posting
- Any automatic LinkedIn DM sending
- Any LinkedIn connection-request automation
- Any mass cold email automation
- Any scraping beyond approved RSS + manual inputs
- Deep CRM sync or lead enrichment

