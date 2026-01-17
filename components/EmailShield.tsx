'use client'

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Shield, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react"

interface EmailShieldProps {
  email: string
  className?: string
}

type VerificationStatus = 'verified' | 'invalid' | 'unknown' | 'checking'

export function EmailShield({ email, className = '' }: EmailShieldProps) {
  const [status, setStatus] = useState<VerificationStatus>('unknown')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (email) {
      verifyEmail(email)
    }
  }, [email])

  const verifyEmail = async (emailAddress: string) => {
    setLoading(true)
    setStatus('checking')

    try {
      const response = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailAddress }),
      })

      if (!response.ok) {
        throw new Error('Verification failed')
      }

      const data = await response.json()
      setStatus(data.status === 'deliverable' ? 'verified' : 'invalid')
    } catch (error) {
      console.error('Error verifying email:', error)
      setStatus('unknown')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Badge
        variant="outline"
        className={`border-cyan-500/30 bg-cyan-500/10 text-cyan-400 ${className}`}
      >
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Verifying
      </Badge>
    )
  }

  if (status === 'verified') {
    return (
      <Badge
        variant="outline"
        className={`border-green-500/30 bg-green-500/10 text-green-400 ${className}`}
      >
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Verified
      </Badge>
    )
  }

  if (status === 'invalid') {
    return (
      <Badge
        variant="outline"
        className={`border-red-500/30 bg-red-500/10 text-red-400 ${className}`}
      >
        <XCircle className="h-3 w-3 mr-1" />
        Invalid
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={`border-muted-foreground/30 bg-muted/10 text-muted-foreground ${className}`}
    >
      <AlertCircle className="h-3 w-3 mr-1" />
      Unknown
    </Badge>
  )
}
