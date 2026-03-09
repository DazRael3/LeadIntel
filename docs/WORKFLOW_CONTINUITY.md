# Workflow continuity (between-page polish)

Goal: After an action, users should immediately understand:

1) **What happened**
2) **What changed**
3) **What to do next**

## Continuity standards

- Provide direct next-step links after key actions:
  - generate pitch/report
  - save output
  - approve template
  - export
  - send webhook/test event
- Preserve context when navigating:
  - keep company/account identifiers in query params when appropriate
  - avoid dumping users on a dead-end list page without state
- Prefer consistent toast language across surfaces:
  - success: “Saved.” / “Copied.” / “Queued.” (short)
  - error: “Something didn’t work.” + one next step

## Avoid

- Duplicated banners everywhere (“next step” spam)
- Silent failures
- Ambiguous “Generated” labels when output is a locked preview

