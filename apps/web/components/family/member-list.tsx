'use client'

import { useEffect, useState } from 'react'
import { familyAPI, type FamilyMember } from '@/lib/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface MemberListProps {
  familyId: string
  isOwner: boolean
}

export function MemberList({ familyId, isOwner }: MemberListProps) {
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMembers = async () => {
    try {
      setLoading(true)
      const data = await familyAPI.getMembers()
      setMembers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [familyId])

  const handleRemove = async (userId: string, displayName: string | null) => {
    if (!confirm(`Are you sure you want to remove ${displayName || 'this member'} from the family?`)) {
      return
    }

    try {
      await familyAPI.removeMember(userId)
      setMembers(members.filter(m => m.user_id !== userId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>All members of your family</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-sm text-destructive mb-4">{error}</p>
        )}

        <div className="divide-y">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {(member.display_name || 'M')[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium">
                    {member.display_name || 'Member'}
                    {member.role === 'owner' && (
                      <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        Owner
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {member.images_processed} image{member.images_processed !== 1 ? 's' : ''} processed
                  </p>
                </div>
              </div>

              {isOwner && member.role !== 'owner' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleRemove(member.user_id, member.display_name)}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
