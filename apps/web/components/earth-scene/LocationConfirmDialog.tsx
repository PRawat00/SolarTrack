'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'

export type ConfirmDialogVariant = 'update' | 'login-required'

interface LocationConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  onCancel?: () => void
  currentLocationName?: string
  newLocationName: string
  variant: ConfirmDialogVariant
  isLoading?: boolean
}

export function LocationConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  currentLocationName,
  newLocationName,
  variant,
  isLoading = false,
}: LocationConfirmDialogProps) {
  const handleCancel = () => {
    onCancel?.()
    onClose()
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] animate-in fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-full max-w-md">
          <div className="bg-zinc-900/95 backdrop-blur-md rounded-xl border border-white/10 p-6 shadow-2xl animate-in fade-in zoom-in-95">
            {variant === 'login-required' ? (
              <>
                <Dialog.Title className="text-xl font-semibold text-white mb-2">
                  Login Required
                </Dialog.Title>
                <Dialog.Description className="text-sm text-white/60 mb-6">
                  Please log in to save <span className="text-orange-400">{newLocationName}</span> as your location.
                  Your selection will be remembered after you log in.
                </Dialog.Description>

                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={handleCancel}
                    className="flex-1 text-white/70 hover:text-white hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={onConfirm}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    Continue to Login
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Dialog.Title className="text-xl font-semibold text-white mb-2">
                  Change Location?
                </Dialog.Title>
                <Dialog.Description className="text-sm text-white/60 mb-4">
                  Your current location is <span className="text-blue-400">{currentLocationName}</span>.
                </Dialog.Description>
                <p className="text-sm text-white/80 mb-2">
                  You are about to change it to <span className="text-orange-400">{newLocationName}</span>.
                </p>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-6">
                  <p className="text-sm text-yellow-400">
                    Changing your location will clear weather data from your readings.
                    You will need to re-fetch weather data for the new location.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="flex-1 text-white/70 hover:text-white hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={onConfirm}
                    disabled={isLoading}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
                  >
                    {isLoading ? 'Updating...' : 'Update Location'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
