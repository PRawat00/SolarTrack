'use client'

import { useState, useEffect } from 'react'
import { familyAPI, type Family } from '@/lib/api/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface JoinFamilyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onJoined: (family: Family) => void
  initialToken?: string
}

export function JoinFamilyDialog({ open, onOpenChange, onJoined, initialToken }: JoinFamilyDialogProps) {
  const [token, setToken] = useState(initialToken || '')
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [familyName, setFamilyName] = useState<string | null>(null)

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open && initialToken) {
      setToken(initialToken)
    }
    if (!open) {
      setToken('')
      setFamilyName(null)
      setError(null)
    }
  }, [open, initialToken])

  // Validate token when it looks like a UUID
  useEffect(() => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(token)) {
      validateToken(token)
    } else {
      setFamilyName(null)
    }
  }, [token])

  const validateToken = async (t: string) => {
    try {
      setValidating(true)
      setError(null)
      const result = await familyAPI.validateInvite(t)
      setFamilyName(result.family_name)
    } catch {
      setFamilyName(null)
    } finally {
      setValidating(false)
    }
  }

  const extractTokenFromInput = (input: string): string => {
    // Try to extract token from URL if user pastes a full invite link
    const urlMatch = input.match(/token=([0-9a-f-]{36})/i)
    if (urlMatch) {
      return urlMatch[1]
    }
    // Otherwise just return the input trimmed
    return input.trim()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('Please enter an invite token')
      return
    }

    try {
      setLoading(true)
      const family = await familyAPI.join(token)
      onJoined(family)
      setToken('')
      setFamilyName(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join family')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Join a Family</DialogTitle>
          <DialogDescription>
            Paste an invite link or enter the invite token to join a family.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="token">Invite Link or Token</Label>
              <Input
                id="token"
                value={token}
                onChange={(e) => setToken(extractTokenFromInput(e.target.value))}
                placeholder="Paste invite link or token"
                required
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Get an invite link from a family member
              </p>
            </div>

            {validating && (
              <p className="text-sm text-muted-foreground">Validating invite...</p>
            )}

            {familyName && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-400">
                  You will join: <strong>{familyName}</strong>
                </p>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !familyName}>
              {loading ? 'Joining...' : 'Join Family'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
