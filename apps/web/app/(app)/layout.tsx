import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/app-nav'
import { PendingLocationDialog } from '@/components/dashboard/PendingLocationDialog'

// Force dynamic rendering - this layout requires auth check
export const dynamic = 'force-dynamic'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNav user={user} />
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
      <PendingLocationDialog />
    </div>
  )
}
