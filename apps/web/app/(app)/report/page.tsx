'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { statsAPI, type StatsResponse, type TrendsResponse, type RecordsResponse } from '@/lib/api/client'
import { SolarLegacyReport } from '@/components/report/solar-legacy-report'
import { Button } from '@/components/ui/button'

export default function ReportPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [trends, setTrends] = useState<TrendsResponse | null>(null)
  const [records, setRecords] = useState<RecordsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch all data in parallel
        const [statsData, trendsData, recordsData] = await Promise.all([
          statsAPI.get(),
          statsAPI.getTrends('yearly'),
          statsAPI.getRecords(),
        ])

        setStats(statsData)
        setTrends(trendsData)
        setRecords(recordsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load report data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 mx-auto rounded-full border-4 border-orange-500 border-t-transparent animate-spin mb-4" />
          <p className="text-muted-foreground">Generating your report...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  // Empty state - no readings
  if (!stats || stats.reading_count === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">No Data Yet</h2>
          <p className="text-muted-foreground mb-4">
            Upload some solar production readings first to generate your Solar Legacy Report.
          </p>
          <Link href="/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  // Render the report
  return (
    <SolarLegacyReport
      stats={stats}
      trends={trends!}
      records={records!}
    />
  )
}
