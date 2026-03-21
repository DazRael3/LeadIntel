import type { ProspectSignalType } from './classify'

export type OutreachDrafts = {
  email: { subject: string; body: string }
  followUp: { subject: string; body: string }
  linkedinDm: { body: string }
  callOpener: { body: string }
}

export type LinkedInPostDraft = { angle: string; body: string; cta: string | null }

function cleanLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function signalAngle(type: ProspectSignalType): string {
  switch (type) {
    case 'funding':
      return 'Congrats on the raise — timing for pipeline + execution'
    case 'hiring':
      return 'Hiring surge — timing to tighten outbound focus'
    case 'product_launch':
      return 'Launch window — timing to create demand quickly'
    case 'partnership':
      return 'Partnership announcement — timing to activate new routes to market'
    case 'expansion':
      return 'Expansion motion — timing to prioritize accounts and messaging'
    case 'leadership_hire':
      return 'New GTM leadership — timing to align outbound motion'
    case 'stack_change':
      return 'Stack change window — timing to simplify prioritization'
    default:
      return 'Timing signal — why now'
  }
}

export function generateOutreachDrafts(args: {
  companyName: string
  companyDomain: string | null
  signalType: ProspectSignalType
  signalTitle: string
  signalSummary: string | null
}): OutreachDrafts {
  const company = cleanLine(args.companyName)
  const angle = signalAngle(args.signalType)
  const whyNowLine = cleanLine(args.signalSummary ?? angle)
  const proofLine = cleanLine(args.signalTitle)

  const subject = `${company} — quick note on timing`
  const body = [
    `Hi — quick note on timing for ${company}.`,
    ``,
    `Saw: ${proofLine}.`,
    `Why now: ${whyNowLine}.`,
    ``,
    `LeadIntel is a signal-based outbound workflow: it helps reps know who to contact now, why now, and what to say next (drafts included).`,
    ``,
    `If you’re open, I can share a 2-minute sample digest for ${company} and a draft outreach angle tied to this signal.`,
    ``,
    `Worth a quick look this week?`,
  ].join('\n')

  const followSubject = `Re: ${company} — timing`
  const followBody = [
    `Bumping this — happy to send a short sample digest + draft outreach angle for ${company}.`,
    `If this isn’t relevant, no worries — just tell me who owns outbound prioritization.`,
  ].join('\n')

  const linkedinDm = [
    `Quick note on timing for ${company}: ${proofLine}.`,
    `If helpful, I can send a short sample digest + draft angle tied to this signal.`,
    `Worth a look this week?`,
  ].join(' ')

  const callOpener = [
    `Hi — quick call. I saw ${company} ${proofLine.toLowerCase()}.`,
    `We built LeadIntel to surface why-now signals and draft outreach so reps can execute fast.`,
    `Could I send you a 2-minute sample digest for ${company}?`,
  ].join(' ')

  return {
    email: { subject, body },
    followUp: { subject: followSubject, body: followBody },
    linkedinDm: { body: linkedinDm },
    callOpener: { body: callOpener },
  }
}

export function generateLinkedInPostDraft(args: {
  companyName: string
  signalType: ProspectSignalType
  signalTitle: string
  signalSummary: string | null
}): LinkedInPostDraft {
  const company = cleanLine(args.companyName)
  const angle = signalAngle(args.signalType)
  const whyNow = cleanLine(args.signalSummary ?? angle)
  const proof = cleanLine(args.signalTitle)

  const body = [
    `${angle}`,
    ``,
    `${company}: ${proof}`,
    ``,
    `This is the moment teams either:`,
    `- spray outreach, or`,
    `- prioritize a shortlist with a real “why now” and message angle.`,
    ``,
    `My rule: if you can’t explain why now in 1 sentence, the rep won’t execute.`,
    ``,
    `Why now: ${whyNow}`,
    ``,
    `If you want, I can share the checklist we use to turn signals into send-ready drafts (no fluff).`,
  ].join('\n')

  return { angle, body, cta: 'Comment “WHY NOW” and I’ll DM it.' }
}

