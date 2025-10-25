"use client"

interface AITutorStatusProps {
  isActive: boolean
}

export function AITutorStatus({ isActive }: AITutorStatusProps) {
  return (
    <div className="absolute top-20 left-1/2 z-40 -translate-x-1/2">
      <div className="bg-card/60 backdrop-blur-glass flex items-center gap-3 rounded-full px-5 py-3 shadow-lg">
        {/* Breathing dot indicator */}
        <div className="relative flex items-center justify-center">
          <div
            className={`bg-sakura h-2 w-2 rounded-full transition-all duration-300 ${
              isActive ? "animate-breathing" : ""
            }`}
          />
        </div>

        {/* Status text */}
        <div className="text-sm">
          <p className="text-foreground font-medium">今日は発音を練習しましょう</p>
          <p className="text-muted-foreground text-xs">Let&apos;s practice pronunciation today</p>
        </div>
      </div>
    </div>
  )
}
