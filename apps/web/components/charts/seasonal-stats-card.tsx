'use client'

import { useState, useEffect, useMemo } from 'react'
import { statsAPI, type SeasonalComparisonResponse } from '@/lib/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Season colors and icons
const SEASON_CONFIG = {
  Winter: {
    color: '#06b6d4',
    bgColor: 'bg-cyan-500/10',
    textColor: 'text-cyan-500',
    icon: '❄️',
  },
  Spring: {
    color: '#10b981',
    bgColor: 'bg-green-500/10',
    textColor: 'text-green-500',
    icon: '🌱',
  },
  Summer: {
    color: '#f59e0b',
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-500',
    icon: '☀️',
  },
  Fall: {
    color: '#f97316',
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-500',
    icon: '🍂',
  },
}

function getCurrentSeason(): 'Winter' | 'Spring' | 'Summer' | 'Fall' {
  const month = new Date().getMonth() + 1 // 1-12
  if (month === 12 || month <= 2) return 'Winter'
  if (month >= 3 && month <= 5) return 'Spring'
  if (month >= 6 && month <= 8) return 'Summer'
  return 'Fall'
}

export function SeasonalStatsCard() {
  const [data, setData] = useState<SeasonalComparisonResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const response = await statsAPI.getSeasonalComparison()
        setData(response)
      } catch (err) {
        console.error('Failed to load seasonal stats:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const currentSeason = getCurrentSeason()
  const currentSeasonStats = data?.season_stats.find(s => s.season === currentSeason)

  const bestSeason = useMemo(() => {
    if (!data) return null
    return data.season_stats.reduce((best, season) =>
      season.avg_production > best.avg_production ? season : best
    )
  }, [data])

  const worstSeason = useMemo(() => {
    if (!data) return null
    return data.season_stats.reduce((worst, season) =>
      season.avg_production < worst.avg_production ? season : worst
    )
  }, [data])

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Seasonal Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            Loading...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.season_stats.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Seasonal Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            No seasonal data available
          </div>
        </CardContent>
      </Card>
    )
  }

  const SeasonIcon = ({ season }: { season: string }) => {
    const config = SEASON_CONFIG[season as keyof typeof SEASON_CONFIG]
    return <span className="text-lg">{config.icon}</span>
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Seasonal Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Season */}
        {currentSeasonStats && (
          <div className={cn(
            'p-3 rounded-lg border-2',
            SEASON_CONFIG[currentSeason].bgColor
          )}
            style={{ borderColor: SEASON_CONFIG[currentSeason].color }}
          >
            <div className="flex items-center gap-2 mb-2">
              <SeasonIcon season={currentSeason} />
              <p className={cn('text-sm font-medium', SEASON_CONFIG[currentSeason].textColor)}>
                Current Season: {currentSeason}
              </p>
            </div>
            {currentSeasonStats.current_year_production !== null ? (
              <>
                <p className="text-2xl font-bold">
                  {currentSeasonStats.current_year_production.toFixed(0)} kWh
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Avg: {currentSeasonStats.avg_production.toFixed(0)} kWh
                </p>
                {currentSeasonStats.vs_average_percent !== null && (
                  <p className={cn(
                    'text-sm font-medium mt-1',
                    currentSeasonStats.vs_average_percent >= 0 ? 'text-green-500' : 'text-red-500'
                  )}>
                    {currentSeasonStats.vs_average_percent >= 0 ? '↑' : '↓'}
                    {Math.abs(currentSeasonStats.vs_average_percent).toFixed(1)}% vs avg
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No data yet</p>
            )}
          </div>
        )}

        {/* Best Season */}
        {bestSeason && (
          <div className="border-t pt-3">
            <div className="flex items-center gap-2 mb-2">
              <SeasonIcon season={bestSeason.season} />
              <p className="text-xs text-muted-foreground">Best Season</p>
            </div>
            <p className="font-medium">{bestSeason.season}</p>
            <p className="text-lg font-bold text-orange-500">
              {bestSeason.avg_production.toFixed(0)} kWh avg
            </p>
            {bestSeason.best_year && bestSeason.best_production && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Peak: {bestSeason.best_production.toFixed(0)} kWh ({bestSeason.best_year})
              </p>
            )}
          </div>
        )}

        {/* Worst Season */}
        {worstSeason && (
          <div className="border-t pt-3">
            <div className="flex items-center gap-2 mb-2">
              <SeasonIcon season={worstSeason.season} />
              <p className="text-xs text-muted-foreground">Lowest Season</p>
            </div>
            <p className="font-medium">{worstSeason.season}</p>
            <p className="text-lg font-bold text-blue-500">
              {worstSeason.avg_production.toFixed(0)} kWh avg
            </p>
            {worstSeason.worst_year && worstSeason.worst_production && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Low: {worstSeason.worst_production.toFixed(0)} kWh ({worstSeason.worst_year})
              </p>
            )}
          </div>
        )}

        {/* All Seasons Grid */}
        <div className="border-t pt-3">
          <p className="text-xs text-muted-foreground mb-2">All Seasons (Avg)</p>
          <div className="grid grid-cols-2 gap-2">
            {data.season_stats.map(season => {
              const config = SEASON_CONFIG[season.season as keyof typeof SEASON_CONFIG]
              return (
                <div
                  key={season.season}
                  className={cn('p-2 rounded-md', config.bgColor)}
                >
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-sm">{config.icon}</span>
                    <p className="text-xs font-medium">{season.season}</p>
                  </div>
                  <p className={cn('text-sm font-bold', config.textColor)}>
                    {season.avg_production.toFixed(0)} kWh
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
