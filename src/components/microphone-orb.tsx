"use client"

import { Mic } from "lucide-react"
import { cn } from "~/lib/utils"
import type { MicState } from "./conversation-page"

interface MicrophoneOrbProps {
  state: MicState
  onClick: () => void
}

export function MicrophoneOrb({ state, onClick }: MicrophoneOrbProps) {
  return (
    <button
      onClick={onClick}
      className="group relative flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`Microphone ${state}`}
    >
      {/* Outer glow rings */}
      {state === "listening" && (
        <>
          <div className="absolute h-48 w-48 rounded-full bg-sakura/20 animate-breathing" />
          <div
            className="absolute h-40 w-40 rounded-full bg-sakura/30 animate-breathing"
            style={{ animationDelay: "0.3s" }}
          />
        </>
      )}

      {/* Processing ring */}
      {state === "processing" && (
        <div className="absolute h-44 w-44 rounded-full border-2 border-t-sakura border-r-sakura border-b-transparent border-l-transparent animate-spin-slow" />
      )}

      {/* Speaking waveform */}
      {state === "speaking" && (
        <div className="absolute flex items-center justify-center gap-1">
          {[...Array({length: 5})].map((_, i) => (
            <div
              key={i}
              className="w-1 h-16 bg-sakura rounded-full animate-waveform"
              style={{
                animationDelay: `${i * 0.1}s`,
                height: `${40 + i * 8}px`,
              }}
            />
          ))}
        </div>
      )}

      {/* Main orb */}
      <div
        className={cn(
          "relative z-10 flex h-32 w-32 items-center justify-center rounded-full transition-all duration-300",
          "bg-gradient-to-br from-card to-sakura-light shadow-2xl",
          state === "idle" && "animate-pulse-glow",
          state === "listening" && "scale-110 shadow-sakura/50",
          state === "processing" && "scale-105",
          state === "speaking" && "scale-105 opacity-90",
        )}
      >
        <Mic
          className={cn(
            "h-12 w-12 transition-colors duration-300",
            state === "idle" && "text-muted-foreground",
            state === "listening" && "text-sakura",
            state === "processing" && "text-sakura",
            state === "speaking" && "text-sakura"
          )}
        />
      </div>

      {/* Subtle hint text */}
      <div className="absolute -bottom-12 text-sm text-muted-foreground">
        {state === "idle" && "Tap to speak"}
        {state === "listening" && "Listening..."}
        {state === "processing" && "Processing..."}
        {state === "speaking" && "AI is speaking"}
      </div>
    </button>
  )
}
