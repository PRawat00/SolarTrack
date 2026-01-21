'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { statsAPI, type SeasonalComparisonResponse } from '@/lib/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Color palette for up to 10 years
const YEAR_COLORS = [
  '#f59e0b', // Amber
  '#3b82f6', // Blue
  '#10b981', // Green
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#84cc16', // Lime
  '#06b6d4', // Cyan
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function SeasonalComparisonChart() {
  const [data, setData] = useState<SeasonalComparisonResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set())
  const [showSeasonalAvg, setShowSeasonalAvg] = useState(false)

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1 // 1-12

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await statsAPI.getSeasonalComparison()
        setData(response)

        // Default: show last 3 years
        const sortedYears = response.available_years.sort((a, b) => b - a)
        const defaultYears = sortedYears.slice(0, 3)
        setSelectedYears(new Set(defaultYears))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load seasonal data')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Transform data for Recharts (group by month, pivot by year)
  const chartData = useMemo(() => {
    if (!data) return []

    const result: Record<number, any> = {}

    // Initialize all 12 months
    for (let month = 1; month <= 12; month++) {
      result[month] = {
        month,
        monthName: MONTHS[month - 1],
        isCurrent: month === currentMonth,
      }
    }

    // Add production data for selected years
    data.monthly_data.forEach(point => {
      if (selectedYears.has(point.year)) {
        const monthKey = `year_${point.year}`
        result[point.month][monthKey] = point.production
      }
    })

    // Calculate seasonal averages for each month if enabled
    if (showSeasonalAvg) {
      for (let month = 1; month <= 12; month++) {
        const monthData = data.monthly_data.filter(p => p.month === month)
        if (monthData.length > 0) {
          const avg = monthData.reduce((sum, p) => sum + p.production, 0) / monthData.length
          result[month].seasonal_avg = avg
        }
      }
    }

    return Object.values(result)
  }, [data, selectedYears, showSeasonalAvg, currentMonth])

  // Toggle year selection
  const toggleYear = (year: number) => {
    const newSelection = new Set(selectedYears)
    if (newSelection.has(year)) {
      // Don't allow deselecting all years
      if (newSelection.size > 1) {
        newSelection.delete(year)
      }
    } else {
      newSelection.add(year)
    }
    setSelectedYears(newSelection)
  }

  // Get year-over-year % change for current year
  const yoyChange = useMemo(() => {
    if (!data || !data.year_stats.length) return null

    const currentYearStats = data.year_stats.find(s => s.year === currentYear)
    const lastYearStats = data.year_stats.find(s => s.year === currentYear - 1)

    if (!currentYearStats || !lastYearStats || lastYearStats.total_production === 0) {
      return null
    }

    const change = ((currentYearStats.total_production - lastYearStats.total_production) / lastYearStats.total_production) * 100
    return change
  }, [data, currentYear])

  const formatXAxis = (value: string, index: number) => {
    // Show month name
    const monthData = chartData[index]
    if (monthData?.isCurrent) {
      return `${value} ★`
    }
    return value
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const monthData = chartData.find(d => d.monthName === label)
      return (
        <div className="bg-card border rounded-lg p-3 shadow-lg max-w-xs">
          <p className="font-medium mb-1.5 text-sm">
            {label} {monthData?.isCurrent ? '(current)' : ''}
          </p>
          <div className="space-y-1">
            {payload
              .filter((p: any) => p.dataKey !== 'seasonal_avg')
              .map((entry: any, index: number) => {
                const year = entry.dataKey.replace('year_', '')
                return (
                  <p key={index} className="text-sm" style={{ color: entry.color }}>
                    {year}: {entry.value?.toFixed(1) || 0} kWh
                  </p>
                )
              })}
            {showSeasonalAvg && payload.find((p: any) => p.dataKey === 'seasonal_avg') && (
              <p className="text-sm text-muted-foreground border-t pt-1 mt-1">
                Avg: {payload.find((p: any) => p.dataKey === 'seasonal_avg')?.value?.toFixed(1)} kWh
              </p>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="flex-1">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Year-over-Year Comparison</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Monthly production across years
                {yoyChange !== null && (
                  <span className={cn(
                    'ml-2 font-medium',
                    yoyChange >= 0 ? 'text-green-500' : 'text-red-500'
                  )}>
                    {yoyChange >= 0 ? '↑' : '↓'} {Math.abs(yoyChange).toFixed(1)}% vs last year
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => setShowSeasonalAvg(!showSeasonalAvg)}
              className={cn(
                'p-2 rounded-md text-xs font-medium transition-all whitespace-nowrap',
                showSeasonalAvg
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title={showSeasonalAvg ? 'Hide seasonal average' : 'Show seasonal average'}
            >
              Avg Line
            </button>
          </div>

          {/* Year selector pills */}
          <div className="flex flex-wrap gap-1.5">
            {data?.available_years.sort((a, b) => b - a).map((year, index) => (
              <button
                key={year}
                onClick={() => toggleYear(year)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  selectedYears.has(year)
                    ? 'text-white shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                )}
                style={
                  selectedYears.has(year)
                    ? { backgroundColor: YEAR_COLORS[index % YEAR_COLORS.length] }
                    : undefined
                }
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-80 flex items-center justify-center text-muted-foreground">
            Loading chart...
          </div>
        ) : error ? (
          <div className="h-80 flex items-center justify-center text-destructive">
            {error}
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-muted-foreground">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" opacity={0.5} />
              {/* @ts-ignore - recharts types issue */}
              <XAxis
                dataKey="monthName"
                tickFormatter={formatXAxis}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' } as any}
                axisLine={{ stroke: 'hsl(var(--muted))' } as any}
                tickLine={{ stroke: 'hsl(var(--muted))' } as any}
              />
              {/* @ts-ignore - recharts types issue */}
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' } as any}
                axisLine={{ stroke: 'hsl(var(--muted))' } as any}
                tickLine={{ stroke: 'hsl(var(--muted))' } as any}
                tickFormatter={(value: number) => `${value}`}
                label={{
                  value: 'kWh',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' }
                } as any}
              />
              {/* @ts-ignore - recharts types issue */}
              <Tooltip content={<CustomTooltip />} />
              {/* @ts-ignore - recharts types issue */}
              <Legend
                wrapperStyle={{ paddingTop: '10px' }}
                formatter={(value: string) => {
                  if (value === 'seasonal_avg') return 'Historical Avg'
                  return value.replace('year_', '')
                }}
              />

              {/* Year lines */}
              {data?.available_years
                .filter(year => selectedYears.has(year))
                .sort((a, b) => a - b)
                .map((year) => (
                  <Line
                    key={year}
                    type="monotone"
                    dataKey={`year_${year}`}
                    name={`year_${year}`}
                    stroke={YEAR_COLORS[data.available_years.indexOf(year) % YEAR_COLORS.length]}
                    strokeWidth={year === currentYear ? 3 : 2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                  />
                ))}

              {/* Seasonal average line */}
              {showSeasonalAvg && (
                <Line
                  type="monotone"
                  dataKey="seasonal_avg"
                  name="seasonal_avg"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
