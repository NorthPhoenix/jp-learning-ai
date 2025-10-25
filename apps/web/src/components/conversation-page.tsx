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

  const voice = { micState: "idle" as MicState }

  const handleMicClick = () => {
    console.log("handleMicClick")
  }

  return (
    <div className="from-background via-background to-sakura-light/10 bg-linear-to-b relative h-screen w-full overflow-hidden">
      {/* Top Bar */}
      <header className="absolute left-0 right-0 top-0 z-50 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="text-foreground text-lg font-medium tracking-tight">日本語 AI</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="hover:bg-muted/50 h-9 w-9 rounded-full">
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="hover:bg-muted/50 h-9 w-9 rounded-full">
            <User className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* AI Tutor Status */}
      <AITutorStatus isActive={voice.micState === "speaking"} />

      {/* Main Content */}
      <main className="flex h-full flex-col items-center justify-center px-6 pb-32 pt-24">
        {/* Conversation Messages */}
        <ConversationMessages messages={messages} isAISpeaking={voice.micState === "speaking"} />

        {/* Microphone Orb */}
        <div className="mt-auto">
          <MicrophoneOrb state={voice.micState} onClick={handleMicClick} />
        </div>
      </main>

      {/* Learning Panel Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="bg-card/80 backdrop-blur-glass hover:bg-card absolute bottom-8 right-8 h-12 w-12 rounded-full shadow-lg"
        onClick={() => setIsPanelOpen(!isPanelOpen)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Learning Panel */}
      <LearningPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} />
    </div>
  )
}
