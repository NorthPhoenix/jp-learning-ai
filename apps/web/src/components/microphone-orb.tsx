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
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        console.log(
          `%cMicrophoneOrb clicked, state: ${state}`,
          "color: #ff0000; font-weight: bold;",
        )
        onClick()
      }}
      className="focus-visible:ring-ring group relative flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      aria-label={`Microphone ${state}`}
    >
      {/* Outer glow rings */}
      {state === "listening" && (
        <>
          <div className="bg-sakura/20 animate-breathing absolute h-48 w-48 rounded-full" />
          <div
            className="bg-sakura/30 animate-breathing absolute h-40 w-40 rounded-full"
            style={{ animationDelay: "0.3s" }}
          />
        </>
      )}

      {/* Processing ring */}
      {state === "pending" && (
        <div className="border-t-sakura border-r-sakura animate-spin-slow absolute h-44 w-44 rounded-full border-2 border-b-transparent border-l-transparent" />
      )}

      {/* Speaking waveform */}
      {/* {state === "speaking" && (
        <div className="absolute flex items-center justify-center gap-1">
          {[...Array({ length: 5 })].map((_, i) => (
            <div
              key={i}
              className="bg-sakura animate-waveform h-16 w-1 rounded-full"
              style={{
                animationDelay: `${i * 0.1}s`,
                height: `${40 + i * 8}px`,
              }}
            />
          ))}
        </div>
      )} */}

      {/* Main orb */}
      <div
        className={cn(
          "relative z-10 flex h-32 w-32 items-center justify-center rounded-full transition-all duration-300",
          "from-card to-sakura-light bg-linear-to-br shadow-2xl",
          state === "idle" && "animate-pulse-glow",
          state === "listening" && "shadow-sakura/50 scale-110",
          state === "pending" && "scale-105",
          // state === "speaking" && "scale-105 opacity-90",
        )}
      >
        <Mic
          className={cn(
            "h-12 w-12 transition-colors duration-300",
            state === "idle" && "text-muted-foreground",
            state === "listening" && "text-sakura",
            state === "pending" && "text-sakura",
            // state === "speaking" && "text-sakura",
          )}
        />
      </div>

      {/* Subtle hint text */}
      <div className="text-muted-foreground absolute -bottom-12 text-sm">
        {state === "idle" && "Tap to speak"}
        {state === "listening" && "Listening..."}
        {state === "pending" && "Processing..."}
        {/* {state === "speaking" && "AI is speaking"} */}
      </div>
    </button>
  )
}
