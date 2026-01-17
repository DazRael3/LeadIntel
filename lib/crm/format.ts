type Payload = { company?: string | null; url?: string | null; pitch?: string | null; tags?: string[] }

export function formatForHubSpot({ company, url, pitch, tags }: Payload): string {
  return [
    `Company: ${company || 'Unknown'}`,
    `Website: ${url || 'N/A'}`,
    `Tags: ${tags && tags.length ? tags.join(', ') : 'None'}`,
    '',
    'Pitch:',
    pitch || '',
  ].join('\n')
}

export function formatForSalesforce({ company, url, pitch, tags }: Payload): string {
  return [
    `Account: ${company || 'Unknown'}`,
    `Domain: ${url || 'N/A'}`,
    `Tags: ${tags && tags.length ? tags.join(' | ') : 'None'}`,
    '',
    'Notes:',
    pitch || '',
  ].join('\n')
}
