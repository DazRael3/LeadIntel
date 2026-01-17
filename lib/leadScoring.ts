export interface LeadScoringInput {
  companyName?: string
  pitch?: string
}

const CTA_KEYWORDS = ['book a demo', 'schedule', 'call', 'meeting', 'signup', 'sign up', 'start', 'trial']
const PERSONALIZATION_SIGNALS = ['you', 'your', 'company', 'team', 'product', 'recent', 'launch', 'funding', 'news', 'hiring']

export function scoreLead({ companyName, pitch }: LeadScoringInput): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []
  const normalizedPitch = (pitch || '').toLowerCase()

  if (companyName && companyName.trim().length > 1) {
    score += 15
    reasons.push('Company identified')
  }

  if (pitch) {
    const len = pitch.trim().length
    if (len > 400) {
      score += 30
      reasons.push('Pitch has good length')
    } else if (len > 200) {
      score += 20
      reasons.push('Pitch has fair length')
    } else if (len > 80) {
      score += 10
      reasons.push('Pitch is short')
    }

    if (CTA_KEYWORDS.some(k => normalizedPitch.includes(k))) {
      score += 20
      reasons.push('Contains a clear CTA')
    }

    const signalsFound = PERSONALIZATION_SIGNALS.filter(k => normalizedPitch.includes(k)).length
    if (signalsFound >= 4) {
      score += 20
      reasons.push('Strong personalization signals')
    } else if (signalsFound >= 2) {
      score += 10
      reasons.push('Some personalization signals')
    }
  }

  // Cap between 0 and 100
  score = Math.max(0, Math.min(100, score))
  return { score, reasons }
}
