"use client"

import { useState } from "react"
import { Menu } from "lucide-react"
import { Button } from "~/components/ui/button"
import { MicrophoneOrb } from "~/components/microphone-orb"
import { ConversationMessages } from "~/components/conversation-messages"
import { LearningPanel } from "~/components/learning-panel"
import { AITutorStatus } from "~/components/ai-tutor-status"
import useVoice from "~/hooks/useVoice"

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
  const { data } = useVoice()

  const voice = { micState: "idle" as MicState }

  const handleMicClick = () => {
    console.log("handleMicClick")
  }

  return (
    <div className="from-background via-background to-sakura-light/10 relative h-screen w-full overflow-hidden bg-linear-to-b">
      {/* AI Tutor Status */}
      <AITutorStatus isActive={voice.micState === "speaking"} />

      {/* Main Content */}
      <main className="flex h-full flex-col items-center justify-center px-6 pt-24 pb-32">
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
