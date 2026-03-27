import { useEffect, useState } from 'react'

export function useDocumentVisibility(): boolean {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const onChange = () => setVisible(!document.hidden)
    onChange()
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  return visible
}

