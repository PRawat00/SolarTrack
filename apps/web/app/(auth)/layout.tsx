import { ChristmasTheme } from '@/components/christmas'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <ChristmasTheme />
      <div className="w-full max-w-md px-4 pt-16">
        {children}
      </div>
    </div>
  )
}
