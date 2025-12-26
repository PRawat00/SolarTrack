'use client'

import { useState, useEffect } from 'react'
import { statsAPI, type StatsResponse } from '@/lib/api/client'
import { createClient } from '@/lib/supabase/client'
import { StatsCard, AddReadingsCard } from '@/components/dashboard/stats-card'
import { UploadPanel } from '@/components/dashboard/upload-panel'
import { ImpactSidebar } from '@/components/dashboard/impact-sidebar'
import { ProductionTrendChart } from '@/components/charts/production-trend-chart'
import { ProductionHeatmap, BestDaysSidebar } from '@/components/charts/production-heatmap'
import { GiftWrap } from '@/components/christmas/gift-wrap'

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear())
  const [userId, setUserId] = useState<string | undefined>()

  const loadStats = async () => {
    try {
      setLoading(true)
      const data = await statsAPI.get()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
    // Get user ID for gift wrap state
    const getUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id)
    }
    getUser()
  }, [])

  const formatNumber = (num: number, decimals = 0) => {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }

  const handleUploadComplete = () => {
    setShowUpload(false)
    loadStats() // Refresh stats after upload
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton for top cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl bg-card p-4 animate-pulse">
              <div className="w-10 h-10 bg-muted rounded-lg mb-3" />
              <div className="h-8 bg-muted rounded w-24 mb-2" />
              <div className="h-4 bg-muted rounded w-32" />
            </div>
          ))}
        </div>
        {/* Loading skeleton for main content */}
        <div className="grid lg:grid-cols-[1fr,320px] gap-6">
          <div className="rounded-xl bg-card p-6 animate-pulse">
            <div className="h-64 bg-muted rounded" />
          </div>
          <div className="space-y-4">
            <div className="rounded-xl bg-card p-4 animate-pulse h-48" />
            <div className="rounded-xl bg-card p-4 animate-pulse h-36" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive mb-2">{error}</p>
          <button
            onClick={loadStats}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Add Readings Card */}
        <GiftWrap id="gift-add-readings" userId={userId}>
          <AddReadingsCard
            isActive={showUpload}
            onClick={() => setShowUpload(!showUpload)}
          />
        </GiftWrap>

        {/* Estimated Generation */}
        <GiftWrap id="gift-generation" userId={userId}>
          <StatsCard
            icon={
              <svg className="w-5 h-5 text-amber-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
            iconBgColor="bg-amber-500"
            value={`${formatNumber(stats?.total_production || 0)} kWh`}
            label="Estimated Generation"
          />
        </GiftWrap>

        {/* Estimated Savings */}
        <GiftWrap id="gift-savings" userId={userId}>
          <StatsCard
            icon={
              <svg className="w-5 h-5 text-green-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            iconBgColor="bg-green-500"
            value={`${stats?.currency_symbol || '$'}${formatNumber(stats?.money_saved || 0, 2)}`}
            label="Estimated Savings"
          />
        </GiftWrap>

        {/* CO2 Offset */}
        <GiftWrap id="gift-co2" userId={userId}>
          <StatsCard
            icon={
              <svg className="w-5 h-5 text-emerald-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            iconBgColor="bg-emerald-500"
            value={`${formatNumber(stats?.co2_offset || 0)} kg`}
            label="CO2 Offset"
          />
        </GiftWrap>
      </div>

      {/* Upload Panel (conditional) */}
      {showUpload && (
        <UploadPanel
          visible={showUpload}
          onComplete={handleUploadComplete}
          onCancel={() => setShowUpload(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="grid lg:grid-cols-[minmax(0,1fr),320px] gap-6">
        {/* Chart */}
        <GiftWrap id="gift-trend-chart" userId={userId}>
          <ProductionTrendChart />
        </GiftWrap>

        {/* Sidebar */}
        <GiftWrap id="gift-impact-sidebar" userId={userId}>
          <ImpactSidebar
            treesEquivalent={stats?.trees_equivalent || 0}
            specificYield={stats?.specific_yield || 0}
            yearlyGoal={stats?.yearly_goal || 0}
            totalProduction={stats?.total_production || 0}
            goalProgress={stats?.goal_progress || 0}
          />
        </GiftWrap>
      </div>

      {/* Heatmap */}
      <div className="grid lg:grid-cols-[minmax(0,1fr),320px] gap-6">
        <GiftWrap id="gift-heatmap" userId={userId}>
          <ProductionHeatmap year={heatmapYear} onYearChange={setHeatmapYear} />
        </GiftWrap>
        <GiftWrap id="gift-best-days" userId={userId}>
          <BestDaysSidebar year={heatmapYear} />
        </GiftWrap>
      </div>

    </div>
  )
}
