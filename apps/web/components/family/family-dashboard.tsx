'use client'

import { useState } from 'react'
import Link from 'next/link'
import { type Family, type FamilyDashboard } from '@/lib/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MemberList } from './member-list'

interface FamilyDashboardViewProps {
  family: Family
  dashboard: FamilyDashboard | null
  onRefresh: () => void
  onLeave: () => void
}

export function FamilyDashboardView({ family, dashboard, onRefresh, onLeave }: FamilyDashboardViewProps) {
  const [showJoinCode, setShowJoinCode] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyJoinCode = async () => {
    await navigator.clipboard.writeText(family.join_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{family.name}</h1>
          <p className="text-muted-foreground">
            {family.member_count} member{family.member_count !== 1 ? 's' : ''}
            {family.is_owner && ' (Owner)'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onRefresh}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
          <Button variant="outline" onClick={onLeave}>
            Leave Family
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/family/images">
          <Card className="cursor-pointer hover:border-primary transition-colors h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Image Pool
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{dashboard?.stats.pending_images ?? 0}</p>
              <p className="text-sm text-muted-foreground">pending images</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/family/leaderboard">
          <Card className="cursor-pointer hover:border-primary transition-colors h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{dashboard?.stats.processed_images ?? 0}</p>
              <p className="text-sm text-muted-foreground">images processed</p>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Readings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{dashboard?.stats.total_readings_extracted ?? 0}</p>
            <p className="text-sm text-muted-foreground">readings extracted</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{dashboard?.stats.member_count ?? family.member_count}</p>
            <p className="text-sm text-muted-foreground">family members</p>
          </CardContent>
        </Card>
      </div>

      {/* Join Code Section */}
      <Card>
        <CardHeader>
          <CardTitle>Invite Members</CardTitle>
          <CardDescription>Share the join code and password with family members</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">Join Code</p>
              <div className="flex items-center gap-2">
                <code className="text-2xl font-mono font-bold tracking-wider">
                  {showJoinCode ? family.join_code : '********'}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowJoinCode(!showJoinCode)}
                >
                  {showJoinCode ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={copyJoinCode}>
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            New members will also need the family password you set when creating the family.
          </p>
        </CardContent>
      </Card>

      {/* Leaderboard Preview */}
      {dashboard && dashboard.leaderboard.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Top Contributors</CardTitle>
              <CardDescription>Family members ranked by images processed</CardDescription>
            </div>
            <Link href="/family/leaderboard">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard.leaderboard.slice(0, 5).map((entry) => (
                <div key={entry.user_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      entry.rank === 1 ? 'bg-yellow-500 text-yellow-950' :
                      entry.rank === 2 ? 'bg-gray-300 text-gray-700' :
                      entry.rank === 3 ? 'bg-amber-600 text-amber-950' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {entry.rank}
                    </div>
                    <div>
                      <p className="font-medium">{entry.display_name || 'Member'}</p>
                      <p className="text-sm text-muted-foreground">
                        {entry.contribution_percent.toFixed(1)}% contribution
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{entry.images_processed}</p>
                    <p className="text-sm text-muted-foreground">images</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {dashboard && dashboard.recent_activity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest processed images</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboard.recent_activity.slice(0, 5).map((activity) => (
                <div key={activity.image_id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-medium">{activity.processed_by_name || 'Member'}</span>
                    <span className="text-muted-foreground">processed</span>
                    <span className="font-mono text-xs">{activity.filename}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {activity.readings_count} reading{activity.readings_count !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <MemberList familyId={family.id} isOwner={family.is_owner} />
    </div>
  )
}
