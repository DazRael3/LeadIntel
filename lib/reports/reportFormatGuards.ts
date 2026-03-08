export function looksLikeEmail(markdown: string): boolean {
  const text = (markdown ?? '').trim()
  if (!text) return false

  const top = text.slice(0, 1200).toLowerCase()
  const firstLine = (text.split('\n')[0] ?? '').trim().toLowerCase()

  if (firstLine.startsWith('subject:')) return true
  if (top.includes('\ndear ') || top.startsWith('dear ')) return true
  if (top.includes('best regards') || top.includes('sincerely,')) return true

  // Self-referential links are a pitch-email artifact; a report should not contain them.
  if (top.includes('view the report here')) return true
  if (top.includes('dazrael.com/competitive-report')) return true

  return false
}

export function stripSelfReferentialLinks(markdown: string): string {
  const lines = (markdown ?? '').split('\n')
  const out: string[] = []
  for (const line of lines) {
    const l = line.toLowerCase()
    if (l.includes('dazrael.com/competitive-report')) continue
    if (l.includes('view the report here')) continue
    if (l.includes('view more about our intelligence platform here')) continue
    out.push(line)
  }
  return out.join('\n').trim() + '\n'
}

export function ensureReportHeadings(markdown: string, companyName: string): string {
  const text = (markdown ?? '').trim()
  const expected = `# Competitive Intelligence Report: ${companyName}`.trim()
  if (!text) return `${expected}\n\n`
  const firstLine = (text.split('\n')[0] ?? '').trim()
  if (firstLine.toLowerCase().startsWith('# competitive intelligence report:')) return text + '\n'
  return `${expected}\n\n${text}\n`
}

