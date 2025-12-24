'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatMessage, type ChatMessageData } from './chat-message'
import { chatAPI } from '@/lib/api/client'
import { cn } from '@/lib/utils'

interface Suggestion {
  label: string
  query: string
}

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { label: 'This month', query: 'What was my total production this month?' },
  { label: 'Last 7 days', query: 'Show me production for the last 7 days' },
  { label: 'Best day', query: 'What was my best production day?' },
  { label: 'vs Weather', query: 'How does sunshine affect my production?' },
]

interface ChatPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>(DEFAULT_SUGGESTIONS)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Load suggestions on mount
  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const response = await chatAPI.getSuggestions()
        setSuggestions(response.suggestions)
      } catch {
        // Use defaults
      }
    }
    loadSuggestions()
  }, [])

  const handleSubmit = async (query: string) => {
    if (!query.trim() || isLoading) return

    const userMessage: ChatMessageData = {
      id: Date.now().toString(),
      role: 'user',
      content: query.trim(),
    }

    const loadingMessage: ChatMessageData = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: 'Analyzing your data...',
      loading: true,
    }

    setMessages((prev) => [...prev, userMessage, loadingMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await chatAPI.query(query.trim())

      const assistantMessage: ChatMessageData = {
        id: loadingMessage.id,
        role: 'assistant',
        content: response.answer,
        data: response.data,
        chart: response.chart || undefined,
        error: response.error || undefined,
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === loadingMessage.id ? assistantMessage : m))
      )
    } catch (err) {
      const errorMessage: ChatMessageData = {
        id: loadingMessage.id,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request.',
        error: err instanceof Error ? err.message : 'Unknown error',
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === loadingMessage.id ? errorMessage : m))
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuggestionClick = (query: string) => {
    handleSubmit(query)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(input)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-background border-l shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-sm">Solar Assistant</h2>
            <p className="text-xs text-muted-foreground">Ask about your solar data</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-medium mb-2">Ask about your solar data</h3>
            <p className="text-sm text-muted-foreground mb-6">
              I can help you analyze your production, compare trends, and visualize your data.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  onClick={() => handleSuggestionClick(s.query)}
                  className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-full transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Suggestion chips (when there are messages) */}
      {messages.length > 0 && !isLoading && (
        <div className="px-4 py-2 border-t bg-muted/30">
          <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
            {suggestions.slice(0, 4).map((s) => (
              <button
                key={s.label}
                onClick={() => handleSuggestionClick(s.query)}
                className="flex-shrink-0 px-2.5 py-1 text-xs bg-muted hover:bg-muted/80 rounded-full transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your solar data..."
            disabled={isLoading}
            className={cn(
              'flex-1 px-4 py-2 bg-muted border-0 rounded-full text-sm',
              'focus:outline-none focus:ring-2 focus:ring-orange-500',
              'placeholder:text-muted-foreground',
              isLoading && 'opacity-50'
            )}
          />
          <button
            onClick={() => handleSubmit(input)}
            disabled={!input.trim() || isLoading}
            className={cn(
              'p-2 rounded-full transition-colors',
              input.trim() && !isLoading
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
