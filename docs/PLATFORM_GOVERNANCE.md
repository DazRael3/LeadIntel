# Platform governance

Platform surfaces (API keys, embeds, extensions) are gated by **workspace policies**.

## Policy location

- Policy schema: `lib/domain/workspace-policies.ts`
- Read/update route: `/api/workspace/policies`
- UI: `/settings/platform`

## Platform policy keys

- `platform.apiAccessEnabled`
- `platform.embedEnabled`
- `platform.extensionsEnabled`
- `platform.apiKeyManageRoles`
- `platform.allowedKeyScopes`

## Enforcement

- Platform API routes check `platform.apiAccessEnabled` server-side.
- Embed token minting checks `platform.embedEnabled`.
- Extensions routes check `platform.extensionsEnabled`.

