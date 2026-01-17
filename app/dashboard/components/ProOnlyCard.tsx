'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, Lock, DollarSign } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ProOnlyCardProps {
  title: string
  description: string
  icon: 'shield' | 'lock'
  iconColor?: 'cyan' | 'purple'
}

export function ProOnlyCard({ title, description, icon, iconColor = 'cyan' }: ProOnlyCardProps) {
  const router = useRouter()
  const IconComponent = icon === 'shield' ? Shield : Lock
  
  const borderClass = iconColor === 'purple' 
    ? 'border-purple-500/30' 
    : 'border-cyan-500/30'
  const iconClass = iconColor === 'purple'
    ? 'text-purple-400'
    : 'text-cyan-400'

  return (
    <Card className={`${borderClass} bg-card/60`}>
      <CardContent className="py-8 text-center space-y-4">
        <IconComponent className={`h-10 w-10 mx-auto ${iconClass}`} />
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
        <Button onClick={() => router.push('/pricing')} className="neon-border hover:glow-effect">
          <DollarSign className="h-4 w-4 mr-2" />
          Upgrade to Pro
        </Button>
      </CardContent>
    </Card>
  )
}
