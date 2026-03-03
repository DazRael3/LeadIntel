export function JsonLd(props: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- JSON-LD required
      dangerouslySetInnerHTML={{ __html: JSON.stringify(props.data) }}
    />
  )
}

