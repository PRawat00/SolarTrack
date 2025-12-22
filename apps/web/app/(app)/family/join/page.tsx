'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { familyAPI } from '@/lib/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function JoinFamilyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'validating' | 'valid' | 'invalid' | 'joining' | 'success' | 'already_member'>('validating')
  const [familyName, setFamilyName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      setError('No invite token provided')
      return
    }

    // First check if user is already in a family
    familyAPI.get()
      .then(family => {
        if (family) {
          setStatus('already_member')
          setFamilyName(family.name)
        } else {
          // Validate the invite token
          validateToken()
        }
      })
      .catch(() => {
        // Not authenticated or error - try to validate anyway
        validateToken()
      })

    async function validateToken() {
      try {
        const result = await familyAPI.validateInvite(token!)
        setFamilyName(result.family_name)
        setStatus('valid')
      } catch (err) {
        setStatus('invalid')
        setError(err instanceof Error ? err.message : 'Invalid or expired invite link')
      }
    }
  }, [token])

  const handleJoin = async () => {
    if (!token) return

    try {
      setStatus('joining')
      await familyAPI.join(token)
      setStatus('success')
      setTimeout(() => router.push('/family'), 1500)
    } catch (err) {
      setStatus('invalid')
      setError(err instanceof Error ? err.message : 'Failed to join family')
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {status === 'validating' && 'Validating Invite...'}
            {status === 'valid' && 'Join Family'}
            {status === 'invalid' && 'Invalid Invite'}
            {status === 'joining' && 'Joining...'}
            {status === 'success' && 'Welcome!'}
            {status === 'already_member' && 'Already a Member'}
          </CardTitle>
          <CardDescription>
            {status === 'validating' && 'Please wait while we verify the invite link'}
            {status === 'valid' && familyName && `You've been invited to join "${familyName}"`}
            {status === 'invalid' && 'This invite link is invalid or has expired'}
            {status === 'joining' && 'Please wait...'}
            {status === 'success' && `You've joined ${familyName}! Redirecting...`}
            {status === 'already_member' && `You're already a member of "${familyName}". Leave your current family first to join a new one.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'validating' && (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}

          {status === 'valid' && (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {familyName}
                </p>
              </div>
              <Button onClick={handleJoin} className="w-full" size="lg">
                Join Family
              </Button>
            </div>
          )}

          {status === 'invalid' && (
            <div className="space-y-4">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
                <p className="text-sm text-destructive">{error}</p>
              </div>
              <Button onClick={() => router.push('/family')} variant="outline" className="w-full">
                Go to Family Page
              </Button>
            </div>
          )}

          {status === 'joining' && (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}

          {status === 'success' && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
              <svg className="w-12 h-12 text-green-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-green-600 dark:text-green-400">Successfully joined!</p>
            </div>
          )}

          {status === 'already_member' && (
            <div className="space-y-4">
              <Button onClick={() => router.push('/family')} className="w-full">
                Go to Your Family
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
