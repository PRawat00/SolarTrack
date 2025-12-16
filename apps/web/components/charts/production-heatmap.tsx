'use client'

import { useState, useEffect, useMemo } from 'react'
import { statsAPI, type TrendDataPoint } from '@/lib/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ProductionHeatmapProps {
  year?: number
  onYearChange?: (year: number) => void
}

interface DayData {
  date: string
  value: number
  dayOfWeek: number
  weekIndex: number
}

interface BestDay {
  date: string
  value: number
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Separate sidebar component for Best Days
export function BestDaysSidebar({ year: propYear }: { year?: number }) {
  const currentYear = new Date().getFullYear()
  const year = propYear || currentYear
  const [data, setData] = useState<TrendDataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const response = await statsAPI.getTrends('daily')
        setData(response.data)
      } catch (err) {
        console.error('Failed to load best days data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const bestDayThisYear = useMemo((): BestDay | null => {
    let best: BestDay | null = null
    data.forEach(item => {
      const itemYear = parseInt(item.date.split('-')[0])
      if (itemYear === year && item.total > (best?.value || 0)) {
        best = { date: item.date, value: item.total }
      }
    })
    return best
  }, [data, year])

  const bestDayOverall = useMemo((): BestDay | null => {
    let best: BestDay | null = null
    data.forEach(item => {
      if (item.total > (best?.value || 0)) {
        best = { date: item.date, value: item.total }
      }
    })
    return best
  }, [data])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Best Days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
            Loading...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Best Days</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Best Day {year}</p>
          {bestDayThisYear ? (
            <div>
              <p className="text-2xl font-bold text-orange-500">
                {bestDayThisYear.value.toFixed(1)} kWh
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(bestDayThisYear.date)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data</p>
          )}
        </div>
        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground mb-1">Best Day Overall</p>
          {bestDayOverall ? (
            <div>
              <p className="text-2xl font-bold text-orange-500">
                {bestDayOverall.value.toFixed(1)} kWh
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(bestDayOverall.date)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function ProductionHeatmap({ year: controlledYear, onYearChange }: ProductionHeatmapProps) {
  const currentYear = new Date().getFullYear()
  const [internalYear, setInternalYear] = useState(controlledYear || currentYear)

  // Use controlled year if provided, otherwise use internal state
  const year = controlledYear ?? internalYear
  const setYear = (newYear: number) => {
    setInternalYear(newYear)
    onYearChange?.(newYear)
  }
  const [data, setData] = useState<TrendDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredCell, setHoveredCell] = useState<DayData | null>(null)

  // Fetch daily data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const response = await statsAPI.getTrends('daily')
        setData(response.data)
      } catch (err) {
        console.error('Failed to load heatmap data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Create a map of date -> total production
  const productionMap = useMemo(() => {
    const map = new Map<string, number>()
    data.forEach(item => {
      map.set(item.date, item.total)
    })
    return map
  }, [data])

  // Generate all days for the year
  const { days, maxValue, monthLabels } = useMemo(() => {
    const result: DayData[] = []
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31)

    // Find the first Sunday before or on Jan 1
    const firstDay = new Date(startDate)
    firstDay.setDate(firstDay.getDate() - firstDay.getDay())

    let maxVal = 0
    let currentDate = new Date(firstDay)
    let weekIndex = 0

    // Track month positions for labels
    const months: { month: number; weekIndex: number }[] = []
    let lastMonth = -1

    while (currentDate <= endDate || currentDate.getDay() !== 0) {
      const dateStr = currentDate.toISOString().split('T')[0]
      const isInYear = currentDate.getFullYear() === year
      const value = isInYear ? (productionMap.get(dateStr) || 0) : -1 // -1 for out of year

      if (isInYear && value > maxVal) {
        maxVal = value
      }

      // Track month changes for labels
      if (isInYear && currentDate.getMonth() !== lastMonth) {
        months.push({ month: currentDate.getMonth(), weekIndex })
        lastMonth = currentDate.getMonth()
      }

      result.push({
        date: dateStr,
        value,
        dayOfWeek: currentDate.getDay(),
        weekIndex,
      })

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1)
      if (currentDate.getDay() === 0) {
        weekIndex++
      }
    }

    return { days: result, maxValue: maxVal || 1, monthLabels: months }
  }, [year, productionMap])

  // Get intensity color based on value
  const getIntensityColor = (value: number) => {
    if (value < 0) return 'bg-transparent' // Out of year
    if (value === 0) return 'bg-muted/30'
    const ratio = value / maxValue
    if (ratio < 0.25) return 'bg-orange-900/60'
    if (ratio < 0.50) return 'bg-orange-700/80'
    if (ratio < 0.75) return 'bg-orange-500'
    return 'bg-orange-400'
  }

  // Group days by week
  const weeks = useMemo(() => {
    const weekMap = new Map<number, DayData[]>()
    days.forEach(day => {
      if (!weekMap.has(day.weekIndex)) {
        weekMap.set(day.weekIndex, [])
      }
      weekMap.get(day.weekIndex)!.push(day)
    })
    return Array.from(weekMap.values())
  }, [days])

  // Available years (from data)
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    data.forEach(item => {
      const y = parseInt(item.date.split('-')[0])
      if (!isNaN(y)) years.add(y)
    })
    years.add(currentYear)
    return Array.from(years).sort((a, b) => b - a)
  }, [data, currentYear])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Production Activity</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Daily solar production intensity
            </p>
          </div>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="bg-muted/50 border-0 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {loading ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            Loading...
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            {/* Month labels */}
            <div className="flex ml-8 mb-1">
              {monthLabels.map(({ month, weekIndex }, i) => {
                const nextWeek = monthLabels[i + 1]?.weekIndex || weeks.length
                const width = (nextWeek - weekIndex) * 18 // 16px cell + 2px gap
                return (
                  <div
                    key={month}
                    className="text-xs text-muted-foreground"
                    style={{ width: `${width}px` }}
                  >
                    {MONTHS[month]}
                  </div>
                )
              })}
            </div>

            {/* Grid */}
            <div className="flex">
              {/* Day labels */}
              <div className="flex flex-col gap-0.5 mr-1 text-xs text-muted-foreground">
                {DAYS.map((day, i) => (
                  <div
                    key={day}
                    className="h-4 flex items-center"
                    style={{ visibility: i % 2 === 1 ? 'visible' : 'hidden' }}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Cells */}
              <div className="flex gap-0.5 overflow-x-auto">
                {weeks.map((week, weekIdx) => (
                  <div key={weekIdx} className="flex flex-col gap-0.5">
                    {DAYS.map((_, dayIdx) => {
                      const dayData = week.find(d => d.dayOfWeek === dayIdx)
                      if (!dayData || dayData.value < 0) {
                        return <div key={dayIdx} className="w-4 h-4" />
                      }
                      return (
                        <div
                          key={dayIdx}
                          className={cn(
                            'w-4 h-4 rounded-sm cursor-pointer transition-all',
                            getIntensityColor(dayData.value),
                            hoveredCell?.date === dayData.date && 'ring-1 ring-foreground'
                          )}
                          onMouseEnter={() => setHoveredCell(dayData)}
                          onMouseLeave={() => setHoveredCell(null)}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Tooltip */}
            {hoveredCell && (
              <div className="absolute top-0 right-0 bg-popover border rounded-md px-2 py-1 text-xs shadow-lg z-10">
                <p className="font-medium">{formatDate(hoveredCell.date)}</p>
                <p className="text-muted-foreground">
                  {hoveredCell.value.toFixed(1)} kWh
                </p>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
              <span>Less</span>
              <div className="w-4 h-4 rounded-sm bg-muted/30" />
              <div className="w-4 h-4 rounded-sm bg-orange-900/60" />
              <div className="w-4 h-4 rounded-sm bg-orange-700/80" />
              <div className="w-4 h-4 rounded-sm bg-orange-500" />
              <div className="w-4 h-4 rounded-sm bg-orange-400" />
              <span>More</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
