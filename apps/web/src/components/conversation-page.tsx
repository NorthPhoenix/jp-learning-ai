"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Menu } from "lucide-react"
import { toast } from "sonner"
import { Button } from "~/components/ui/button"
import { MicrophoneOrb } from "~/components/microphone-orb"
import { ConversationMessages } from "~/components/conversation-messages"
import { LearningPanel } from "~/components/learning-panel"
import { AITutorStatus } from "~/components/ai-tutor-status"
import useVoice from "~/hooks/useVoice"

export type MicState = "idle" | "listening" | "pending"

export interface Message {
  id: string
  type: "user" | "ai"
  japanese?: string
  english: string
  timestamp: Date
}

export default function ConversationPage() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [messages] = useState<Message[]>([
    {
      id: "1",
      type: "ai",
      japanese: "こんにちは！今日は何を練習したいですか？",
      english: "Hello! What would you like to practice today?",
      timestamp: new Date(),
    },
  ])

  const { connect, startStreaming, stopStreaming, micState, isConnected } = useVoice({
    onError: (err) => {
      console.error("Voice error:", err)
      const isPermission = err.name === "NotAllowedError" || /permission/i.test(err.message ?? "")
      if (isPermission) {
        toast.error("Microphone permission is blocked", {
          description:
            "Click the camera/microphone icon in your browser's address bar and choose Allow, then reload and try again.",
          action: {
            label: "Learn how",
            onClick: () => {
              // Simple cross-browser hint page
              window.open("https://support.google.com/chrome/answer/2693767?hl=en", "_blank")
            },
          },
        })
      } else {
        toast.error("Websocket error occured", {
          description: err.message,
        })
      }
    },
  })

  const handleMicClick = useCallback(() => {
    if (micState === "pending") {
      return
    }
    if (micState === "idle") {
      if (!isConnected) {
        void connect()
        return
      }
      void startStreaming()
      return
    }
    if (micState === "listening") {
      stopStreaming()
      return
    }
  }, [micState, isConnected, connect, startStreaming, stopStreaming])

  return (
    <div className="from-background via-background to-sakura-light/10 relative h-screen w-full overflow-hidden bg-linear-to-b">
      {/* AI Tutor Status */}
      <AITutorStatus isActive={false} />

      {/* Main Content */}
      <main className="flex h-full flex-col items-center justify-center px-6 pt-24 pb-32">
        {/* Conversation Messages */}
        <ConversationMessages messages={messages} isAISpeaking={false} />

        {/* Microphone Orb */}
        <div className="mt-auto">
          <MicrophoneOrb state={micState} onClick={handleMicClick} />
        </div>
      </main>

      {/* Learning Panel Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="bg-card/80 backdrop-blur-glass hover:bg-card absolute right-8 bottom-8 h-12 w-12 rounded-full shadow-lg"
        onClick={() => setIsPanelOpen(!isPanelOpen)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Learning Panel */}
      <LearningPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} />
    </div>
  )
}
