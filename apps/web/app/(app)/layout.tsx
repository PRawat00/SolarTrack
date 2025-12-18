import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/app-nav'
import { PendingLocationDialog } from '@/components/dashboard/PendingLocationDialog'
import { ChristmasTheme } from '@/components/christmas'
import { MOCK_USER } from '@/lib/auth/mock-user'

// Force dynamic rendering - this layout requires auth check
export const dynamic = 'force-dynamic'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Mock auth for local development
  if (process.env.NEXT_PUBLIC_MOCK_AUTH === 'true') {
    return (
      <div className="min-h-screen bg-background">
        <ChristmasTheme />
        <AppNav user={MOCK_USER} />
        <main className="container mx-auto px-4 py-8 pt-20">
          {children}
        </main>
        <PendingLocationDialog />
      </div>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <ChristmasTheme />
      <AppNav user={user} />
      <main className="container mx-auto px-4 py-8 pt-20">
        {children}
      </main>
      <PendingLocationDialog />
    </div>
  )
}
