'use client'

import { DynamicChart } from './dynamic-chart'
import { cn } from '@/lib/utils'

interface ChartConfig {
  answer: string
  type: 'line' | 'bar' | 'area' | 'pie' | 'stat' | 'table'
  xKey?: string
  series?: Array<{
    dataKey: string
    name: string
    color: string
    yAxisId?: string
  }>
  xLabel?: string
  yLabel?: string
  yLabelRight?: string
  value?: number
  label?: string
  unit?: string
}

export interface ChatMessageData {
  id: string
  role: 'user' | 'assistant'
  content: string
  data?: Record<string, unknown>[]
  chart?: ChartConfig
  error?: string
  loading?: boolean
}

interface ChatMessageProps {
  message: ChatMessageData
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium',
          isUser ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground'
        )}
      >
        {isUser ? 'U' : 'AI'}
      </div>

      {/* Message content */}
      <div className={cn('flex-1 max-w-[85%]', isUser && 'text-right')}>
        {/* Text bubble */}
        <div
          className={cn(
            'inline-block rounded-2xl px-4 py-2 text-sm',
            isUser
              ? 'bg-orange-500 text-white rounded-tr-none'
              : 'bg-muted text-foreground rounded-tl-none'
          )}
        >
          {message.loading ? (
            <div className="flex items-center gap-2">
              <span className="animate-pulse">Thinking</span>
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          ) : (
            message.content
          )}
        </div>

        {/* Error message */}
        {message.error && !message.loading && (
          <div className="mt-2 text-sm text-destructive">
            Error: {message.error}
          </div>
        )}

        {/* Chart/visualization */}
        {!isUser && message.chart && message.data && !message.loading && (
          <div className="mt-3 bg-card border rounded-xl p-4">
            <DynamicChart config={message.chart} data={message.data} />
          </div>
        )}
      </div>
    </div>
  )
}
