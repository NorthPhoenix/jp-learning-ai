"use client"

import { useState } from "react"
import { Settings, User, Menu } from "lucide-react"
import { Button } from "~/components/ui/button"
import { MicrophoneOrb } from "~/components/microphone-orb"
import { ConversationMessages } from "~/components/conversation-messages"
import { LearningPanel } from "~/components/learning-panel"
import { AITutorStatus } from "~/components/ai-tutor-status"

export type MicState = "idle" | "listening" | "processing" | "speaking"

export interface Message {
  id: string
  type: "user" | "ai"
  japanese?: string
  english: string
  timestamp: Date
}

export default function ConversationPage() {
  const [micState, setMicState] = useState<MicState>("idle")
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "ai",
      japanese: "こんにちは！今日は何を練習したいですか？",
      english: "Hello! What would you like to practice today?",
      timestamp: new Date(),
    },
  ])

  const handleMicClick = () => {
    if (micState === "idle") {
      setMicState("listening")
      // Simulate voice interaction flow
      setTimeout(() => setMicState("processing"), 2000)
      setTimeout(() => {
        setMicState("speaking")
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            type: "user",
            english: "I want to practice ordering food at a restaurant",
            timestamp: new Date(),
          },
          {
            id: (Date.now() + 1).toString(),
            type: "ai",
            japanese: "いいですね！レストランで注文する練習をしましょう。",
            english: "Great! Let's practice ordering at a restaurant.",
            timestamp: new Date(),
          },
        ])
      }, 3000)
      setTimeout(() => setMicState("idle"), 5000)
    }
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gradient-to-b from-background via-background to-sakura-light/10">
      {/* Top Bar */}
      <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="text-lg font-medium tracking-tight text-foreground">日本語 AI</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-muted/50">
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-muted/50">
            <User className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* AI Tutor Status */}
      <AITutorStatus isActive={micState === "speaking"} />

      {/* Main Content */}
      <main className="flex h-full flex-col items-center justify-center px-6 pb-32 pt-24">
        {/* Conversation Messages */}
        <ConversationMessages messages={messages} isAISpeaking={micState === "speaking"} />

        {/* Microphone Orb */}
        <div className="mt-auto">
          <MicrophoneOrb state={micState} onClick={handleMicClick} />
        </div>
      </main>

      {/* Learning Panel Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute bottom-8 right-8 h-12 w-12 rounded-full bg-card/80 backdrop-blur-glass shadow-lg hover:bg-card"
        onClick={() => setIsPanelOpen(!isPanelOpen)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Learning Panel */}
      <LearningPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} />
    </div>
  )
}
