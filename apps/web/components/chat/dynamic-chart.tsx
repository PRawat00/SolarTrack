'use client'

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface ChartSeries {
  dataKey: string
  name: string
  color: string
  yAxisId?: string
}

interface ChartConfig {
  answer: string
  type: 'line' | 'bar' | 'area' | 'pie' | 'stat' | 'table'
  xKey?: string
  series?: ChartSeries[]
  xLabel?: string
  yLabel?: string
  yLabelRight?: string
  // For stat type
  value?: number
  label?: string
  unit?: string
}

interface DynamicChartProps {
  config: ChartConfig
  data: Record<string, unknown>[]
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']

export function DynamicChart({ config, data }: DynamicChartProps) {
  if (!config || !data) return null

  // Stat card for single values
  if (config.type === 'stat') {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-4xl font-bold text-foreground">
            {typeof config.value === 'number' ? config.value.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            }) : config.value}
            {config.unit && <span className="text-2xl text-muted-foreground ml-1">{config.unit}</span>}
          </div>
          {config.label && (
            <div className="text-sm text-muted-foreground mt-1">{config.label}</div>
          )}
        </div>
      </div>
    )
  }

  // Table view
  if (config.type === 'table') {
    if (data.length === 0) {
      return <div className="text-muted-foreground text-center py-4">No data</div>
    }

    const columns = Object.keys(data[0])

    return (
      <div className="overflow-x-auto max-h-64">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-muted">
              {columns.map((col) => (
                <th key={col} className="text-left py-2 px-3 font-medium text-muted-foreground">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 50).map((row, i) => (
              <tr key={i} className="border-b border-muted/50">
                {columns.map((col) => (
                  <td key={col} className="py-2 px-3">
                    {formatCellValue(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 50 && (
          <div className="text-center text-sm text-muted-foreground py-2">
            Showing 50 of {data.length} rows
          </div>
        )}
      </div>
    )
  }

  // Chart types
  if (data.length === 0) {
    return <div className="text-muted-foreground text-center py-8">No data to display</div>
  }

  const series = config.series || []
  const xKey = config.xKey || Object.keys(data[0])[0]

  // Format x-axis values (dates, etc.)
  const formatXAxis = (value: string) => {
    // Try to detect date format
    if (value && typeof value === 'string') {
      // ISO date: 2024-12-15
      if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
        const date = new Date(value)
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      }
      // Month format: 2024-12
      if (value.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = value.split('-')
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return `${monthNames[parseInt(month) - 1]} ${year.slice(2)}`
      }
    }
    return value
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-1 text-sm">{formatXAxis(label)}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCellValue(entry.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  // Line chart
  if (config.type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" opacity={0.5} />
          <XAxis
            dataKey={xKey}
            tickFormatter={formatXAxis}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--muted))' }}
            tickLine={{ stroke: 'hsl(var(--muted))' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--muted))' }}
            tickLine={{ stroke: 'hsl(var(--muted))' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '10px' }} />
          {series.map((s, i) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color || COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              yAxisId={s.yAxisId || 'left'}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  // Bar chart
  if (config.type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" opacity={0.5} />
          <XAxis
            dataKey={xKey}
            tickFormatter={formatXAxis}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--muted))' }}
            tickLine={{ stroke: 'hsl(var(--muted))' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--muted))' }}
            tickLine={{ stroke: 'hsl(var(--muted))' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '10px' }} />
          {series.map((s, i) => (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.name}
              fill={s.color || COLORS[i % COLORS.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // Area chart
  if (config.type === 'area') {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" opacity={0.5} />
          <XAxis
            dataKey={xKey}
            tickFormatter={formatXAxis}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--muted))' }}
            tickLine={{ stroke: 'hsl(var(--muted))' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--muted))' }}
            tickLine={{ stroke: 'hsl(var(--muted))' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '10px' }} />
          {series.map((s, i) => (
            <Area
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color || COLORS[i % COLORS.length]}
              fill={s.color || COLORS[i % COLORS.length]}
              fillOpacity={0.3}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  // Pie chart
  if (config.type === 'pie') {
    const valueKey = series[0]?.dataKey || Object.keys(data[0]).find(k => k !== xKey) || ''
    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={xKey}
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  return <div className="text-muted-foreground text-center py-4">Unsupported chart type</div>
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number') {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}
