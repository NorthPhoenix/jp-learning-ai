"use client"

import { X, Volume2 } from "lucide-react"
import { Button } from "~/components/ui/button"
import { Progress } from "~/components/ui/progress"

interface LearningPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function LearningPanel({ isOpen, onClose }: LearningPanelProps) {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="bg-background/60 animate-in fade-in fixed inset-0 z-40 backdrop-blur-sm duration-200"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="bg-card/95 backdrop-blur-glass animate-in slide-in-from-right fixed bottom-0 right-0 top-0 z-50 w-full max-w-md shadow-2xl duration-300">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-border/50 flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-foreground text-lg font-semibold">Learning Progress</h2>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
            {/* Current Level */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-foreground text-sm font-medium">Current Level</h3>
                <span className="text-muted-foreground text-sm">N4 - Intermediate</span>
              </div>
              <Progress value={65} className="h-2" />
              <p className="text-muted-foreground text-xs">65% to N3 level</p>
            </div>

            {/* Recent Words & Grammar */}
            <div className="space-y-3">
              <h3 className="text-foreground text-sm font-medium">Recent Words & Grammar</h3>
              <div className="space-y-2">
                {[
                  { jp: "注文する", en: "to order", type: "verb" },
                  { jp: "レストラン", en: "restaurant", type: "noun" },
                  { jp: "〜てください", en: "please do...", type: "grammar" },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="bg-muted/30 flex items-center justify-between rounded-lg px-4 py-3"
                  >
                    <div className="flex-1">
                      <p className="text-foreground text-sm font-medium">{item.jp}</p>
                      <p className="text-muted-foreground text-xs">{item.en}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sakura bg-sakura-light rounded-full px-2 py-1 text-xs">
                        {item.type}
                      </span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
                        <Volume2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Challenging Topics */}
            <div className="space-y-3">
              <h3 className="text-foreground text-sm font-medium">Challenging Topics</h3>
              <div className="flex flex-wrap gap-2">
                {["Particles (は vs が)", "Polite forms", "Counters"].map((topic, i) => (
                  <div
                    key={i}
                    className="bg-destructive/10 text-destructive rounded-full px-3 py-1.5 text-xs font-medium"
                  >
                    {topic}
                  </div>
                ))}
              </div>
            </div>

            {/* Next Lesson */}
            <div className="space-y-3">
              <h3 className="text-foreground text-sm font-medium">Next Lesson</h3>
              <div className="bg-sakura-light border-sakura/20 rounded-lg border p-4">
                <p className="text-foreground text-sm font-medium">Polite forms (〜ます)</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Learn how to conjugate verbs in polite form for formal situations
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
