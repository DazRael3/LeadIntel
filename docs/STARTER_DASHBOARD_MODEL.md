# Starter dashboard model (preview UX)

This document defines the intended **Starter (preview)** dashboard experience.

## Goals
- **Coherent**: one clear story of what’s available vs locked.
- **Entitlement-aware**: only eligible modules mount and request data.
- **Premium/calm**: locked/setup states read as intentional, not broken.

## What Starter users see

### Primary navigation (tab rail)
- **Command Center**
- **Lead Library**
- **Settings**

Advanced tabs (Visitors, Live Intent, Market Pulse, Watchlist) are intentionally **not shown** on Starter to avoid clutter and broken-feeling inactive states.

### Command Center hierarchy (top → down)
1) **Plan strip** (current tier + upgrade CTA)
2) **Core workflow** cards: getting started, activation, recent activity, pitch generator, explainability
3) **Starter guidance card**: what they can do now + what upgrades unlock
4) Optional sidebar modules **only if eligible** (e.g. Team-only action queue is shown as locked, not requested)

## What Starter users can do (truth-first)
- Generate **preview** outputs (pitches/reports) subject to Starter limits
- Track a small set of accounts (as represented by saved/visible leads)
- Learn the workflow (tour + scoring method + templates)

## Upgrade framing (Starter → paid)
- **Closer**: unlocks advanced surfaces and unlimited generation where supported
- **Team**: unlocks team workflow operations (queue/approvals/governance) where implemented

## Non-goals
- Do not mount pro/team modules just to show a blurred preview.
- Do not let background requests spam 403/500 for unavailable features.

