"use client"

import { useState } from "react"
import { Play, Volume2 } from "lucide-react"
import { Button } from "~/components/ui/button"
import type { Message } from "./conversation-page"

interface ConversationMessagesProps {
  messages: Message[]
  isAISpeaking: boolean
}

export function ConversationMessages({ messages, isAISpeaking }: ConversationMessagesProps) {
  const [showTranslation, setShowTranslation] = useState<Record<string, boolean>>({})

  const toggleTranslation = (id: string) => {
    setShowTranslation((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="mb-8 w-full max-w-2xl space-y-4">
      {/* AI Speaking Indicator */}
      {isAISpeaking && (
        <div className="text-muted-foreground animate-fade-slide-up flex items-center justify-center gap-2 text-sm">
          <Volume2 className="text-sakura h-4 w-4" />
          <div className="flex gap-1">
            {[...Array({ length: 3 })].map((_, i) => (
              <div
                key={i}
                className="bg-sakura animate-waveform h-3 w-1 rounded-full"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-3">
        {messages.slice(-4).map((message, index) => (
          <div key={message.id} className="animate-fade-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
            {message.type === "ai" ? (
              <div className="bg-card/60 backdrop-blur-glass flex flex-col gap-2 rounded-2xl p-4 shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    {message.japanese && (
                      <p className="text-foreground text-lg leading-relaxed font-medium">{message.japanese}</p>
                    )}
                    {showTranslation[message.id] && (
                      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{message.english}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {message.japanese && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-muted/50 h-7 w-7 rounded-full"
                        onClick={() => toggleTranslation(message.id)}
                      >
                        <span className="text-xs">EN</span>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="hover:bg-muted/50 h-7 w-7 rounded-full">
                      <Play className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <div className="bg-muted/40 backdrop-blur-glass max-w-[80%] rounded-2xl px-4 py-3 shadow-md">
                  <p className="text-muted-foreground text-sm leading-relaxed">{message.english}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
