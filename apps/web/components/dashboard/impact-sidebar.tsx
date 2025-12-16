'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ImpactSidebarProps {
  treesEquivalent: number
  specificYield: number
  yearlyGoal: number
  totalProduction: number
  goalProgress: number
}

export function ImpactSidebar({
  treesEquivalent,
  specificYield,
  yearlyGoal,
  totalProduction,
  goalProgress,
}: ImpactSidebarProps) {
  const remaining = Math.max(0, yearlyGoal - totalProduction)

  const formatNumber = (num: number, decimals = 0) => {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }

  return (
    <div className="space-y-4">
      {/* Real World Impact */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Real World Impact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Trees Planted */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-cyan-500/20">
              <svg className="w-5 h-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold">{formatNumber(treesEquivalent, 1)}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Trees Planted</div>
            </div>
          </div>

          {/* Specific Yield */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/20">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold">{formatNumber(specificYield, 1)}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Specific Yield (kWh/kWp)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Yearly Goal */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <CardTitle className="text-lg">Yearly Goal</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-bold">{formatNumber(totalProduction)}</div>
            <div className="text-sm text-muted-foreground">/ {formatNumber(yearlyGoal)} kWh</div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-500"
              style={{ width: `${Math.min(goalProgress, 100)}%` }}
            />
          </div>

          <div className="text-sm text-muted-foreground">
            {formatNumber(remaining)} kWh remaining
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
