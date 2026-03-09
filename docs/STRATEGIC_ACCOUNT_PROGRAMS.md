# Strategic account programs

LeadIntel supports a simple program flag for team coordination:

- strategic
- named
- expansion watch
- monitor
- standard

## What it enables

- consistent strategic review lists
- escalation and follow-through reminders
- workflow ownership hygiene (unowned / overlap)

## What it does not claim

- no account hierarchy certainty
- no relationship maps
- no customer success / installed-base data

## Storage

- `api.account_program_accounts`

## How to set

Program state is set via:

- `PATCH /api/accounts/:id/coverage` (privileged roles only)

## Portfolio view

- `/dashboard/portfolio` shows program flags and recent workflow accounts (from action queue metadata).

