'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  icon: ReactNode
  iconBgColor?: string
  value: string
  label: string
  sublabel?: string
  variant?: 'default' | 'clickable' | 'active'
  onClick?: () => void
  className?: string
}

export function StatsCard({
  icon,
  iconBgColor = 'bg-blue-500',
  value,
  label,
  sublabel,
  variant = 'default',
  onClick,
  className,
}: StatsCardProps) {
  const isClickable = variant === 'clickable' || variant === 'active'
  const isActive = variant === 'active'

  return (
    <div
      className={cn(
        'rounded-xl bg-card p-4 transition-all',
        isClickable && 'cursor-pointer hover:bg-card/80',
        isActive && 'ring-2 ring-orange-500',
        className
      )}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <div className={cn(
        'inline-flex items-center justify-center rounded-lg p-2 mb-3',
        iconBgColor
      )}>
        {icon}
      </div>
      <div className="text-3xl font-bold text-foreground">
        {value}
      </div>
      <div className="text-sm text-muted-foreground mt-1">
        {label}
      </div>
      {sublabel && (
        <div className="text-xs text-muted-foreground mt-0.5">
          {sublabel}
        </div>
      )}
    </div>
  )
}

interface AddReadingsCardProps {
  isActive: boolean
  onClick: () => void
}

export function AddReadingsCard({ isActive, onClick }: AddReadingsCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl bg-card p-4 cursor-pointer transition-all hover:bg-card/80',
        isActive && 'ring-2 ring-orange-500'
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className={cn(
        'inline-flex items-center justify-center rounded-full w-10 h-10 mb-3 transition-colors',
        isActive ? 'bg-orange-500' : 'bg-muted'
      )}>
        {isActive ? (
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        )}
      </div>
      <div className={cn(
        'text-sm font-medium',
        isActive ? 'text-orange-500' : 'text-foreground'
      )}>
        {isActive ? 'Close Import' : 'Add Readings'}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">
        Upload photos of logs
      </div>
    </div>
  )
}
