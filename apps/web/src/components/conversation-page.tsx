"use client"

import { useState, useRef, useEffect, useCallback } from "react"
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
  const [micState, setMicState] = useState<MicState>("idle")

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioQueueRef = useRef<ArrayBuffer[]>([])
  const isPlayingRef = useRef(false)

  // Initialize audio context for playback
  useEffect(() => {
    if (typeof window !== "undefined") {
      audioContextRef.current = new AudioContext()
    }
    return () => {
      void audioContextRef.current?.close().catch(() => {
        // Ignore errors on close
      })
    }
  }, [])

  // Play audio queue
  const playAudioQueue = useCallback(async () => {
    if (!audioContextRef.current || isPlayingRef.current) return

    isPlayingRef.current = true
    setMicState("speaking")

    while (audioQueueRef.current.length > 0) {
      const audioData = audioQueueRef.current.shift()
      if (!audioData || !audioContextRef.current) break

      try {
        // Decode audio data
        const audioBuffer = await audioContextRef.current.decodeAudioData(audioData.slice(0))
        const source = audioContextRef.current.createBufferSource()
        source.buffer = audioBuffer
        source.connect(audioContextRef.current.destination)

        await new Promise<void>((resolve) => {
          source.onended = () => resolve()
          source.start(0)
        })
      } catch (error) {
        console.error("Error playing audio:", error)
      }
    }

    isPlayingRef.current = false
    setMicState((prev) => (prev === "speaking" ? "idle" : prev))
  }, [])

  // Handle incoming voice data - play it back
  const handleVoiceData = useCallback(
    (data: ArrayBuffer) => {
      if (!audioContextRef.current) return

      // Add to queue
      audioQueueRef.current.push(data)

      // If not already playing, start playback
      if (!isPlayingRef.current) {
        void playAudioQueue()
      }
    },
    [playAudioQueue],
  )

  const { sendVoiceData, isConnected } = useVoice({
    onVoiceData: handleVoiceData,
    onError: (error) => {
      console.error("Voice error:", error)
      setMicState("idle")
    },
  })

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      })

      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && isConnected) {
          // Convert Blob to ArrayBuffer and send
          void event.data.arrayBuffer().then((buffer) => {
            sendVoiceData(buffer)
          })
        }
      }

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        setMicState("processing")
        // Reset to idle after a short delay
        setTimeout(() => {
          setMicState("idle")
        }, 1000)
      }

      mediaRecorder.start(100) // Send chunks every 100ms
      setMicState("listening")
    } catch (error) {
      console.error("Error starting recording:", error)
      setMicState("idle")
    }
  }, [sendVoiceData, isConnected])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const handleMicClick = useCallback(() => {
    if (micState === "idle") {
      void startRecording()
    } else if (micState === "listening") {
      stopRecording()
    }
  }, [micState, startRecording, stopRecording])

  return (
    <div className="from-background via-background to-sakura-light/10 relative h-screen w-full overflow-hidden bg-linear-to-b">
      {/* AI Tutor Status */}
      <AITutorStatus isActive={micState === "speaking"} />

      {/* Main Content */}
      <main className="flex h-full flex-col items-center justify-center px-6 pt-24 pb-32">
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
