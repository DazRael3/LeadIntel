# Reporting governance

Reporting governance controls **whether summary surfaces are enabled** and **who can view them**.

## Settings surface

- `/settings/reporting`

## Policy keys

Stored in workspace policies (`lib/domain/workspace-policies.ts`):

- `policies.reporting.executiveEnabled`
- `policies.reporting.commandCenterEnabled`
- `policies.reporting.snapshotsEnabled`
- `policies.reporting.executiveViewerRoles`
- `policies.reporting.commandViewerRoles`
- `policies.reporting.mobileQuickActionsEnabled`

## Enforcement

Server-side enforcement occurs in:

- `GET /api/dashboard/executive` (requires policy enabled + role allowlist)
- `GET /api/dashboard/command-center` (requires policy enabled + role allowlist)
- `POST /api/executive/snapshot` (requires executive + snapshots enabled + role allowlist)

Policy changes are audited via `workspace.policy_updated`.

