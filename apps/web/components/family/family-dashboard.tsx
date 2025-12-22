'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { type Family, type FamilyDashboard, type FamilyInvite, familyAPI } from '@/lib/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MemberList } from './member-list'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface FamilyDashboardViewProps {
  family: Family
  dashboard: FamilyDashboard | null
  onRefresh: () => void
  onLeave: () => void
}

export function FamilyDashboardView({ family, dashboard, onRefresh, onLeave }: FamilyDashboardViewProps) {
  const [invites, setInvites] = useState<FamilyInvite[]>([])
  const [loadingInvites, setLoadingInvites] = useState(true)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expiresIn, setExpiresIn] = useState<string>('168') // 7 days
  const [maxUses, setMaxUses] = useState<string>('unlimited')

  // Load invites on mount
  useEffect(() => {
    loadInvites()
  }, [])

  const loadInvites = async () => {
    try {
      setLoadingInvites(true)
      const data = await familyAPI.listInvites()
      setInvites(data)
    } catch (err) {
      console.error('Failed to load invites:', err)
    } finally {
      setLoadingInvites(false)
    }
  }

  const createInvite = async () => {
    try {
      setCreatingInvite(true)
      const invite = await familyAPI.createInvite({
        expiresInHours: expiresIn === 'never' ? undefined : parseInt(expiresIn),
        maxUses: maxUses === 'unlimited' ? undefined : parseInt(maxUses),
      })
      setInvites([invite, ...invites])
    } catch (err) {
      console.error('Failed to create invite:', err)
    } finally {
      setCreatingInvite(false)
    }
  }

  const copyInvite = async (invite: FamilyInvite) => {
    await navigator.clipboard.writeText(invite.invite_url)
    setCopiedId(invite.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const deleteInvite = async (id: string) => {
    try {
      await familyAPI.deactivateInvite(id)
      setInvites(invites.filter(i => i.id !== id))
    } catch (err) {
      console.error('Failed to delete invite:', err)
    }
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

      {/* Invite Members Section */}
      <Card>
        <CardHeader>
          <CardTitle>Invite Members</CardTitle>
          <CardDescription>Create shareable invite links for family members</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Create new invite */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Expires in</label>
              <Select value={expiresIn} onValueChange={setExpiresIn}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="24">1 day</SelectItem>
                  <SelectItem value="168">7 days</SelectItem>
                  <SelectItem value="720">30 days</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Max uses</label>
              <Select value={maxUses} onValueChange={setMaxUses}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 use</SelectItem>
                  <SelectItem value="5">5 uses</SelectItem>
                  <SelectItem value="10">10 uses</SelectItem>
                  <SelectItem value="unlimited">Unlimited</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={createInvite} disabled={creatingInvite}>
              {creatingInvite ? 'Creating...' : 'Create Invite'}
            </Button>
          </div>

          {/* Active invites */}
          {loadingInvites ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : invites.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No active invites. Create one to invite family members.
            </p>
          ) : (
            <div className="space-y-3">
              {invites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex-1 min-w-0">
                    <code className="text-xs font-mono truncate block text-muted-foreground">
                      {invite.invite_url}
                    </code>
                    <p className="text-xs text-muted-foreground mt-1">
                      {invite.max_uses ? `${invite.use_count}/${invite.max_uses} uses` : `${invite.use_count} uses`}
                      {invite.expires_at && ` | Expires ${new Date(invite.expires_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button variant="outline" size="sm" onClick={() => copyInvite(invite)}>
                      {copiedId === invite.id ? 'Copied!' : 'Copy'}
                    </Button>
                    {family.is_owner && (
                      <Button variant="ghost" size="sm" onClick={() => deleteInvite(invite.id)}>
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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
