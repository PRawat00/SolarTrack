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

type Period = 'daily' | 'weekly' | 'monthly'

export function ProductionTrendChart() {
  const [period, setPeriod] = useState<Period>('daily')
  const [data, setData] = useState<TrendDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [showIrradiance, setShowIrradiance] = useState(true)
  const [showSnowfall, setShowSnowfall] = useState(true)

  // Calculate range duration in days
  const rangeDays = useMemo(() => {
    if (!startDate || !endDate) return Infinity
    const start = new Date(startDate)
    const end = new Date(endDate)
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  }, [startDate, endDate])

  // Determine which periods should be disabled
  const isWeeklyDisabled = rangeDays < 7
  const isMonthlyDisabled = rangeDays < 30

  // Auto-switch to valid period if current becomes disabled
  useEffect(() => {
    if (period === 'monthly' && isMonthlyDisabled) {
      setPeriod(isWeeklyDisabled ? 'daily' : 'weekly')
    } else if (period === 'weekly' && isWeeklyDisabled) {
      setPeriod('daily')
    }
  }, [rangeDays, period, isWeeklyDisabled, isMonthlyDisabled])

  // Filter data based on date range
  const filteredData = useMemo(() => {
    if (!startDate && !endDate) return data
    return data.filter(item => {
      // For weekly format (2025-W01), extract year and approximate date
      if (item.date.includes('W')) {
        const [year, week] = item.date.split('-W')
        // Approximate: week 1 starts around Jan 1
        const approxDate = new Date(parseInt(year), 0, 1 + (parseInt(week) - 1) * 7)
        if (startDate && approxDate < new Date(startDate)) return false
        if (endDate && approxDate > new Date(endDate)) return false
        return true
      }
      // For monthly format (2025-01), use first day of month
      if (item.date.match(/^\d{4}-\d{2}$/)) {
        const itemDate = new Date(item.date + '-01')
        if (startDate && itemDate < new Date(startDate)) return false
        if (endDate && itemDate > new Date(endDate)) return false
        return true
      }
      // For daily format (2025-01-15)
      const itemDate = new Date(item.date)
      if (startDate && itemDate < new Date(startDate)) return false
      if (endDate && itemDate > new Date(endDate)) return false
      return true
    })
  }, [data, startDate, endDate])

  useEffect(() => {
    const loadTrends = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await statsAPI.getTrends(period)
        setData(response.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load trends')
      } finally {
        setLoading(false)
      }
    }
    loadTrends()
  }, [period])

  const formatXAxis = (value: string) => {
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

  const ToggleButton = ({
    active,
    onClick,
    disabled,
    children,
  }: {
    active: boolean
    onClick: () => void
    disabled?: boolean
    children: React.ReactNode
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
        disabled && 'opacity-40 cursor-not-allowed',
        active && !disabled
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:text-foreground',
        disabled && 'hover:text-muted-foreground'
      )}
    >
      {children}
    </button>
  )

  return (
    <Card className="flex-1">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>Production Trends</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Daily generation calculated from logs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-muted/50 border-0 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <span className="text-muted-foreground text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-muted/50 border-0 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                x
              </button>
            )}
            <div className="flex bg-muted/50 rounded-lg p-0.5">
              <ToggleButton
                active={period === 'daily'}
                onClick={() => setPeriod('daily')}
              >
                Daily
              </ToggleButton>
              <ToggleButton
                active={period === 'weekly'}
                onClick={() => setPeriod('weekly')}
                disabled={isWeeklyDisabled}
              >
                Weekly
              </ToggleButton>
              <ToggleButton
                active={period === 'monthly'}
                onClick={() => setPeriod('monthly')}
                disabled={isMonthlyDisabled}
              >
                Monthly
              </ToggleButton>
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
              {/* @ts-expect-error - Recharts types incompatible with React 19 */}
              <XAxis
                dataKey="date"
                tickFormatter={formatXAxis}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--muted))' }}
                tickLine={{ stroke: 'hsl(var(--muted))' }}
                interval="preserveStartEnd"
              />
              {/* @ts-expect-error - Recharts types incompatible with React 19 */}
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--muted))' }}
                tickLine={{ stroke: 'hsl(var(--muted))' }}
                tickFormatter={(value: number) => `${value}`}
                label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
              />
              {(showIrradiance || showSnowfall) && (
                // @ts-expect-error - Recharts types incompatible with React 19
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: showIrradiance ? '#3b82f6' : '#06b6d4' }}
                  axisLine={{ stroke: showIrradiance ? '#3b82f6' : '#06b6d4' }}
                  tickLine={{ stroke: showIrradiance ? '#3b82f6' : '#06b6d4' }}
                  tickFormatter={(value: number) => `${value}`}
                  label={{ value: showIrradiance ? 'MJ/m2' : 'cm', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: showIrradiance ? '#3b82f6' : '#06b6d4' } }}
                />
              )}
              {/* @ts-expect-error - Recharts types incompatible with React 19 */}
              <Tooltip content={<CustomTooltip />} />
              {/* @ts-expect-error - Recharts types incompatible with React 19 */}
              <Legend
                wrapperStyle={{ paddingTop: '10px' }}
                formatter={(value: string) => <span className="text-sm text-muted-foreground">{value}</span>}
              />
              {/* @ts-expect-error - Recharts types incompatible with React 19 */}
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
              {/* @ts-expect-error - Recharts types incompatible with React 19 */}
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
              {showIrradiance && (
                // @ts-expect-error - Recharts types incompatible with React 19
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
                />
              )}
              {showSnowfall && (
                // @ts-expect-error - Recharts types incompatible with React 19
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
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
