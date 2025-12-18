'use client'

import { useEffect, useState } from 'react'
import { familyAPI, type Family, type FamilyDashboard } from '@/lib/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FamilyDashboardView } from '@/components/family/family-dashboard'
import { CreateFamilyDialog } from '@/components/family/create-family-dialog'
import { JoinFamilyDialog } from '@/components/family/join-family-dialog'

export default function FamilyPage() {
  const [family, setFamily] = useState<Family | null>(null)
  const [dashboard, setDashboard] = useState<FamilyDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showJoinDialog, setShowJoinDialog] = useState(false)

  const loadFamily = async () => {
    try {
      setLoading(true)
      setError(null)
      const familyData = await familyAPI.get()
      setFamily(familyData)

      if (familyData) {
        const dashboardData = await familyAPI.getDashboard()
        setDashboard(dashboardData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load family data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFamily()
  }, [])

  const handleFamilyCreated = (newFamily: Family) => {
    setFamily(newFamily)
    setShowCreateDialog(false)
    loadFamily()
  }

  const handleFamilyJoined = (joinedFamily: Family) => {
    setFamily(joinedFamily)
    setShowJoinDialog(false)
    loadFamily()
  }

  const handleLeaveFamily = async () => {
    if (!confirm('Are you sure you want to leave this family?')) return

    try {
      await familyAPI.leave()
      setFamily(null)
      setDashboard(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave family')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-destructive">{error}</p>
        <Button onClick={loadFamily}>Try Again</Button>
      </div>
    )
  }

  // User is not in a family - show create/join options
  if (!family) {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Family</h1>
          <p className="text-muted-foreground">
            Join or create a family to collaborate on solar data entry
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setShowCreateDialog(true)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create a Family
              </CardTitle>
              <CardDescription>
                Start a new family and invite others to join
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Create a family to share images and collaborate on solar data entry.
                You&apos;ll get a join code to share with family members.
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setShowJoinDialog(true)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Join a Family
              </CardTitle>
              <CardDescription>
                Enter a join code to join an existing family
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Have a join code? Enter it along with the family password
                to join and start collaborating.
              </p>
            </CardContent>
          </Card>
        </div>

        <CreateFamilyDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreated={handleFamilyCreated}
        />

        <JoinFamilyDialog
          open={showJoinDialog}
          onOpenChange={setShowJoinDialog}
          onJoined={handleFamilyJoined}
        />
      </div>
    )
  }

  // User is in a family - show dashboard
  return (
    <FamilyDashboardView
      family={family}
      dashboard={dashboard}
      onRefresh={loadFamily}
      onLeave={handleLeaveFamily}
    />
  )
}
