// @ts-nocheck
'use client'

import Link from 'next/link'
import { AreaChart, Area, XAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import { Zap, DollarSign, Leaf, Trophy, Calendar, Printer, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { StatsResponse, TrendsResponse, RecordsResponse } from '@/lib/api/client'

interface SolarLegacyReportProps {
  stats: StatsResponse
  trends: TrendsResponse
  records: RecordsResponse
}

export function SolarLegacyReport({ stats, trends, records }: SolarLegacyReportProps) {
  const handlePrint = () => {
    window.print()
  }

  // Calculate years active from first and last reading dates
  const yearsActive = (() => {
    if (!stats.first_reading_date || !stats.last_reading_date) return 0
    const firstYear = parseInt(stats.first_reading_date.substring(0, 4))
    const lastYear = parseInt(stats.last_reading_date.substring(0, 4))
    return lastYear - firstYear + 1
  })()

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    return dateStr
  }

  // Format month (YYYY-MM) to readable format
  const formatMonth = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    const [year, month] = dateStr.split('-')
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${monthNames[parseInt(month) - 1]} ${year}`
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Action Bar - Hidden when printing */}
      <div className="no-print sticky top-0 z-10 bg-white border-b px-4 py-3">
        <div className="max-w-[210mm] mx-auto flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <Button onClick={handlePrint} className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Printable Paper Container */}
      <div className="max-w-[210mm] mx-auto min-h-screen bg-white p-[15mm] flex flex-col print:p-[10mm]">

        {/* Header */}
        <div className="text-center border-b-2 border-amber-400 pb-8 mb-8">
          <h1 className="text-4xl font-serif font-bold text-slate-900 tracking-tight">
            Solar Legacy Report
          </h1>
          <p className="text-slate-500 mt-2 uppercase tracking-widest text-sm">
            Performance Certificate
          </p>
        </div>

        {/* Hero Stats */}
        <div className="grid grid-cols-3 gap-8 mb-12 print:gap-4 print:mb-8">
          <div className="text-center p-6 bg-slate-50 rounded-xl border border-slate-100 print:p-4">
            <Zap className="w-8 h-8 text-amber-500 mx-auto mb-3 print:w-6 print:h-6 print:mb-2" />
            <div className="text-3xl font-bold text-slate-900 print:text-2xl">
              {stats.total_production.toLocaleString()}
            </div>
            <div className="text-sm text-slate-500 uppercase tracking-wide font-medium mt-1">
              kWh Generated
            </div>
          </div>
          <div className="text-center p-6 bg-slate-50 rounded-xl border border-slate-100 print:p-4">
            <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-3 print:w-6 print:h-6 print:mb-2" />
            <div className="text-3xl font-bold text-slate-900 print:text-2xl">
              {stats.currency_symbol}{stats.money_saved.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-sm text-slate-500 uppercase tracking-wide font-medium mt-1">
              Value Created
            </div>
          </div>
          <div className="text-center p-6 bg-slate-50 rounded-xl border border-slate-100 print:p-4">
            <Leaf className="w-8 h-8 text-emerald-600 mx-auto mb-3 print:w-6 print:h-6 print:mb-2" />
            <div className="text-3xl font-bold text-slate-900 print:text-2xl">
              {stats.trees_equivalent.toFixed(1)}
            </div>
            <div className="text-sm text-slate-500 uppercase tracking-wide font-medium mt-1">
              Trees Equivalent
            </div>
          </div>
        </div>

        {/* System Details */}
        <div className="grid grid-cols-2 gap-12 mb-12 print:gap-6 print:mb-8">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4 border-l-4 border-amber-400 pl-3">
              System History
            </h3>
            <ul className="space-y-4 text-sm">
              <li className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">First Recorded Log</span>
                <span className="font-mono font-medium">{formatDate(stats.first_reading_date)}</span>
              </li>
              <li className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Last Recorded Log</span>
                <span className="font-mono font-medium">{formatDate(stats.last_reading_date)}</span>
              </li>
              <li className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Years Active</span>
                <span className="font-mono font-medium">{yearsActive} Year{yearsActive !== 1 ? 's' : ''}</span>
              </li>
              <li className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Total Logs Digitized</span>
                <span className="font-mono font-medium">{stats.reading_count} Entries</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4 border-l-4 border-amber-400 pl-3">
              Hall of Fame
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="bg-amber-100 p-2 rounded text-amber-600">
                  <Trophy size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Best Production Day</div>
                  <div className="text-slate-600 text-sm">
                    {records.best_day
                      ? `${records.best_day.value.toLocaleString()} kWh on ${formatDate(records.best_day.date)}`
                      : 'No data yet'}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-blue-100 p-2 rounded text-blue-600">
                  <Calendar size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Best Production Month</div>
                  <div className="text-slate-600 text-sm">
                    {records.best_month
                      ? `${records.best_month.value.toLocaleString()} kWh in ${formatMonth(records.best_month.date)}`
                      : 'No data yet'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="flex-1 mb-8 print:mb-4">
          <h3 className="text-lg font-bold text-slate-900 mb-6 print:mb-4">Annual Production Trend</h3>
          <div className="h-64 w-full border border-slate-100 rounded-xl p-4 print:h-48">
            {trends.data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {/*ts-expect-error*/}<AreaChart data={trends.data}>
                  {/*ts-expect-error*/}<CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                  {/*ts-expect-error*/}<XAxis
                    dataKey="date"
                    stroke="#64748b"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  {/*ts-expect-error*/}<Area
                    type="monotone"
                    dataKey="total"
                    stroke="#f59e0b"
                    fill="#fef3c7"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                No trend data available
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-8 border-t border-slate-200 text-center print:pt-4">
          <p className="text-slate-400 text-sm italic">
            &quot;The sun provides more energy in one hour than the entire world consumes in a year.&quot;
          </p>
          <div className="mt-4 text-xs text-slate-300">
            Generated by SolarTrack &bull; {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  )
}
