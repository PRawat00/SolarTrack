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
import { statsAPI, type TrendDataPoint } from '@/lib/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { fillDataGaps, parseDate } from '@/lib/utils/date-range'

type Period = 'daily' | 'weekly' | 'monthly'

type PresetPeriod = 'week' | 'month' | '3months' | 'year' | 'all'

interface PeriodPreset {
  label: string
  days: number | null  // null = all time
  aggregation: Period
  description: string
}

const PERIOD_PRESETS: Record<PresetPeriod, PeriodPreset> = {
  week: {
    label: 'Past Week',
    days: 7,
    aggregation: 'daily',
    description: 'Last 7 days'
  },
  month: {
    label: 'Past Month',
    days: 30,
    aggregation: 'daily',
    description: 'Last 30 days'
  },
  '3months': {
    label: 'Past 3 Months',
    days: 90,
    aggregation: 'weekly',
    description: 'Last 90 days'
  },
  year: {
    label: 'Past Year',
    days: 365,
    aggregation: 'monthly',
    description: 'Last 365 days'
  },
  all: {
    label: 'All Time',
    days: null,
    aggregation: 'monthly',
    description: 'Full history'
  }
}

function calculateDateRange(preset: PresetPeriod): { start: string; end: string } | null {
  const config = PERIOD_PRESETS[preset]

  if (config.days === null) {
    // All time - no filtering
    return null
  }

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - config.days)

  return {
    start: start.toISOString().split('T')[0],  // YYYY-MM-DD
    end: end.toISOString().split('T')[0]
  }
}

export function ProductionTrendChart() {
  const [selectedPreset, setSelectedPreset] = useState<PresetPeriod>('month')
  const [data, setData] = useState<TrendDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showIrradiance, setShowIrradiance] = useState(true)
  const [showSnowfall, setShowSnowfall] = useState(true)
  const [fillGaps, setFillGaps] = useState(true)

  // Filter data based on date range and fill gaps for continuous series
  const filteredData = useMemo(() => {
    if (loading || data.length === 0) {
      return []
    }

    const dateRange = calculateDateRange(selectedPreset)
    const preset = PERIOD_PRESETS[selectedPreset]

    // Filter by date range if not "All Time"
    let filtered = data
    if (dateRange) {
      filtered = data.filter(item => {
        // Handle weekly format (2025-W01)
        if (item.date.includes('W')) {
          try {
            const weekStartDate = parseDate(item.date, 'weekly')
            const filterStart = new Date(dateRange.start + 'T00:00:00Z')
            const filterEnd = new Date(dateRange.end + 'T00:00:00Z')
            if (weekStartDate < filterStart || weekStartDate > filterEnd) return false
            return true
          } catch (error) {
            console.error(`Failed to parse weekly date: ${item.date}`, error)
            return false
          }
        }
        // Handle monthly format (2025-01)
        if (item.date.match(/^\d{4}-\d{2}$/)) {
          const itemDate = new Date(item.date + '-01')
          if (itemDate < new Date(dateRange.start) || itemDate > new Date(dateRange.end)) return false
          return true
        }
        // Handle daily format (2025-01-15)
        const itemDate = new Date(item.date)
        if (itemDate < new Date(dateRange.start) || itemDate > new Date(dateRange.end)) return false
        return true
      })
    }

    // Apply gap filling
    return fillGaps
      ? fillDataGaps(filtered, preset.aggregation, dateRange?.start, dateRange?.end)
      : filtered
  }, [data, selectedPreset, loading, fillGaps])

  useEffect(() => {
    const loadTrends = async () => {
      try {
        setLoading(true)
        setError(null)
        setData([])

        const preset = PERIOD_PRESETS[selectedPreset]
        const response = await statsAPI.getTrends(preset.aggregation)
        setData(response.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load trends')
      } finally {
        setLoading(false)
      }
    }
    loadTrends()
  }, [selectedPreset])

  const formatXAxis = (value: string) => {
    const preset = PERIOD_PRESETS[selectedPreset]
    const period = preset.aggregation

    if (period === 'monthly') {
      const [year, month] = value.split('-')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return `${monthNames[parseInt(month) - 1]} ${year.slice(2)}`
    }
    if (period === 'weekly') {
      // Format: "2025-W01" -> "Week 1"
      const match = value.match(/W(\d+)/)
      if (match) {
        return `Week ${parseInt(match[1])}`
      }
      return value
    }
    if (period === 'daily') {
      const parts = value.split('-')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return `${monthNames[parseInt(parts[1]) - 1]} ${parts[2]}`
    }
    return value
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const m1 = payload.find((p: any) => p.dataKey === 'm1')?.value || 0
      const m2 = payload.find((p: any) => p.dataKey === 'm2')?.value || 0
      const radiation = payload.find((p: any) => p.dataKey === 'radiation')?.value || 0
      const snowfall = payload.find((p: any) => p.dataKey === 'snowfall')?.value || 0
      return (
        <div className="bg-card border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-1 text-sm">{label}</p>
          <p className="text-sm" style={{ color: '#f59e0b' }}>
            M1: {m1?.toFixed(1)} kWh
          </p>
          <p className="text-sm" style={{ color: '#fbbf24' }}>
            M2: {m2?.toFixed(1)} kWh
          </p>
          <p className="text-sm font-medium mt-1 text-foreground">
            Total: {(m1 + m2)?.toFixed(1)} kWh
          </p>
          {showIrradiance && radiation > 0 && (
            <p className="text-sm mt-1" style={{ color: '#3b82f6' }}>
              Irradiance: {radiation?.toFixed(1)} MJ/m2
            </p>
          )}
          {showSnowfall && snowfall > 0 && (
            <p className="text-sm mt-1" style={{ color: '#06b6d4' }}>
              Snowfall: {snowfall?.toFixed(1)} cm
            </p>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <Card className="flex-1">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>Production Trends</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {PERIOD_PRESETS[selectedPreset].description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Preset period buttons */}
            <div className="flex bg-muted/50 rounded-lg p-0.5 gap-0.5">
              {(Object.keys(PERIOD_PRESETS) as PresetPeriod[]).map(preset => (
                <button
                  key={preset}
                  onClick={() => setSelectedPreset(preset)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap',
                    selectedPreset === preset
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {PERIOD_PRESETS[preset].label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowIrradiance(!showIrradiance)}
              className={cn(
                'p-1.5 rounded-md transition-all',
                showIrradiance
                  ? 'border border-orange-500 text-orange-500'
                  : 'border border-transparent text-muted-foreground hover:text-foreground'
              )}
              title={showIrradiance ? 'Hide irradiance' : 'Show irradiance'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>
            <button
              onClick={() => setShowSnowfall(!showSnowfall)}
              className={cn(
                'p-1.5 rounded-md transition-all',
                showSnowfall
                  ? 'border border-cyan-500 text-cyan-500'
                  : 'border border-transparent text-muted-foreground hover:text-foreground'
              )}
              title={showSnowfall ? 'Hide snowfall' : 'Show snowfall'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" />
              </svg>
            </button>
            <button
              onClick={() => setFillGaps(!fillGaps)}
              className={cn(
                'p-1.5 rounded-md transition-all',
                fillGaps
                  ? 'border border-green-500 text-green-500'
                  : 'border border-transparent text-muted-foreground hover:text-foreground'
              )}
              title={fillGaps ? 'Disable gap filling (show actual data only)' : 'Enable gap filling (continuous view)'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Loading chart...
          </div>
        ) : error ? (
          <div className="h-64 flex items-center justify-center text-destructive">
            {error}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No data available for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={filteredData} margin={{ top: 10, right: 50, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" opacity={0.5} />
              {/* @ts-ignore - recharts types issue */}
              <XAxis
                dataKey="date"
                tickFormatter={formatXAxis}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' } as any}
                axisLine={{ stroke: 'hsl(var(--muted))' } as any}
                tickLine={{ stroke: 'hsl(var(--muted))' } as any}
                interval="preserveStartEnd"
              />
              {/* @ts-ignore - recharts types issue */}
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' } as any}
                axisLine={{ stroke: 'hsl(var(--muted))' } as any}
                tickLine={{ stroke: 'hsl(var(--muted))' } as any}
                tickFormatter={(value: number) => `${value}`}
                label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } } as any}
              />
              {/* @ts-ignore - recharts types issue */}
              {(showIrradiance || showSnowfall) && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: showIrradiance ? '#3b82f6' : '#06b6d4' } as any}
                  axisLine={{ stroke: showIrradiance ? '#3b82f6' : '#06b6d4' } as any}
                  tickLine={{ stroke: showIrradiance ? '#3b82f6' : '#06b6d4' } as any}
                  tickFormatter={(value: number) => `${value}`}
                  label={{ value: showIrradiance ? 'MJ/m2' : 'cm', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: showIrradiance ? '#3b82f6' : '#06b6d4' } } as any}
                />
              )}
              {/* @ts-ignore - recharts types issue */}
              <Tooltip content={<CustomTooltip />} />
              {/* @ts-ignore - recharts types issue */}
              <Legend
                wrapperStyle={{ paddingTop: '10px' }}
                formatter={(value: string) => <span className="text-sm text-muted-foreground">{value}</span>}
              />
              {/* @ts-ignore - recharts types issue */}
              <Line
                type="monotone"
                dataKey="m1"
                name="M1 (kWh)"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#f59e0b' }}
                yAxisId="left"
              />
              {/* @ts-ignore - recharts types issue */}
              <Line
                type="monotone"
                dataKey="m2"
                name="M2 (kWh)"
                stroke="#fbbf24"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 4, fill: '#fbbf24' }}
                yAxisId="left"
              />
              {/* @ts-ignore - recharts types issue */}
              {showIrradiance && (
                <Line
                  type="monotone"
                  dataKey="radiation"
                  name="Irradiance (MJ/m2)"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                  dot={false}
                  activeDot={{ r: 3, fill: '#3b82f6' }}
                  yAxisId="right"
                  connectNulls={false}
                />
              )}
              {/* @ts-ignore - recharts types issue */}
              {showSnowfall && (
                <Line
                  type="monotone"
                  dataKey="snowfall"
                  name="Snowfall (cm)"
                  stroke="#06b6d4"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                  activeDot={{ r: 3, fill: '#06b6d4' }}
                  yAxisId="right"
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
