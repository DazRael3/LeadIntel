## Purpose

LeadIntel supports users who belong to **multiple workspaces** (teams / clients / business units) while preserving strict workspace isolation.

This wave adds:

- persisted **current workspace selection**
- a first-class **workspace directory**
- a safe **workspace switcher** UX

## Current workspace selection

- Stored per user in `api.users.current_workspace_id` (nullable).
- Resolution logic (server-side):
  - if `current_workspace_id` is set **and** the user is a member of that workspace, it is used
  - otherwise, fall back to the existing behavior (owned workspace → oldest membership)

Implementation:

- `lib/team/workspace.ts` (`getCurrentWorkspace`)
- `lib/services/workspace-switching.ts`
- API: `POST /api/workspaces/switch`

## Workspace directory

The directory lists only workspaces the user can access via `api.workspace_members` (including delegated membership rows).

Implementation:

- `lib/services/workspace-directory.ts`
- API: `GET /api/workspaces/directory`

## UX surfaces

- Dashboard header switcher: `components/navigation/WorkspaceSwitcher.tsx`
- Workspace badge: `components/navigation/WorkspaceContextBadge.tsx`

## Isolation guarantees (what we do and do not claim)

We do **not** claim cross-client data sharing, global objects, or “super-admin” access.

We do claim:

- all account/workflow objects remain **workspace-scoped**
- switching workspaces changes the server-side context used by routes

