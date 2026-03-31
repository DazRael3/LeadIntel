# Feature packaging matrix (plan → capability)

This matrix is used to keep **pricing**, **product gating**, **docs**, and **support answers** aligned.

Legend:
- ✅ Included
- 🔒 Locked/preview-only
- ➕ Higher tier

| Capability | Starter | Closer | Closer+ | Team | Evidence |
|---|---:|---:|---:|---:|---|
| Proof & Sample Mode workspace | ✅ | ✅ | ✅ | ✅ | `app/api/sample-mode/route.ts`, `lib/sample-mode/seed.ts` |
| 1-click tour goals (pipeline/conversion/expansion) | ✅ | ✅ | ✅ | ✅ | `app/api/tour-goal/route.ts`, `components/tour/TourGoalsCard.tsx` |
| Sample digest (no signup) | ✅ | ✅ | ✅ | ✅ | `app/(public)/page.tsx` |
| Templates library (public) | ✅ | ✅ | ✅ | ✅ | `app/(public)/templates/*` |
| Pitch generation | 🔒 (preview counts) | ✅ | ✅ | ✅ | `app/api/generate-pitch/route.ts`, `components/PitchGenerator.tsx` |
| Competitive reports (saved) | 🔒 (preview counts) | ✅ | ✅ | ✅ | `app/api/competitive-report/generate/route.ts`, `app/competitive-report/page.tsx` |
| Watchlists v2 (multi-list + notes + reminders) | ➕ | ✅ | ✅ | ✅ | `supabase/migrations/0078_watchlists_v2.sql` |
| Sources & freshness panel | ➕ | ➕ | ✅ | ✅ | `SourcesFreshnessPanelClient` |
| Refresh sources + regenerate | ➕ | ➕ | ✅ | ✅ | `app/api/sources/refresh/route.ts` |
| Team settings (members) | ➕ | ➕ | ➕ | ✅ | `app/settings/team/page.tsx` |
| Template approvals (Team) | ➕ | ➕ | ➕ | ✅ | `app/settings/templates/page.tsx` |
| Audit logs (Team) | ➕ | ➕ | ➕ | ✅ | `app/settings/audit/page.tsx` |
| Webhooks (Team) | ➕ | ➕ | ➕ | ✅ | `app/settings/integrations/page.tsx` |
| Exports (Team) | ➕ | ➕ | ➕ | ✅ | `app/settings/exports/page.tsx` |
| Admin ops (token gated) | n/a | n/a | n/a | n/a | `app/admin/ops/page.tsx` |

Notes:
- Starter “🔒” means **preview-only**. Full premium content remains locked until upgrade.
- “➕” means “position only when the product surface exists and is gated accordingly.”

