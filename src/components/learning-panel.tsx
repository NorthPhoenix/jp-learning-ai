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
        className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card/95 backdrop-blur-glass shadow-2xl z-50 animate-in slide-in-from-right duration-300">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">Learning Progress</h2>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
            {/* Current Level */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">Current Level</h3>
                <span className="text-sm text-muted-foreground">N4 - Intermediate</span>
              </div>
              <Progress value={65} className="h-2" />
              <p className="text-xs text-muted-foreground">65% to N3 level</p>
            </div>

            {/* Recent Words & Grammar */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Recent Words & Grammar</h3>
              <div className="space-y-2">
                {[
                  { jp: "注文する", en: "to order", type: "verb" },
                  { jp: "レストラン", en: "restaurant", type: "noun" },
                  { jp: "〜てください", en: "please do...", type: "grammar" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{item.jp}</p>
                      <p className="text-xs text-muted-foreground">{item.en}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-sakura bg-sakura-light px-2 py-1 rounded-full">{item.type}</span>
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
              <h3 className="text-sm font-medium text-foreground">Challenging Topics</h3>
              <div className="flex flex-wrap gap-2">
                {["Particles (は vs が)", "Polite forms", "Counters"].map((topic, i) => (
                  <div
                    key={i}
                    className="rounded-full bg-destructive/10 text-destructive px-3 py-1.5 text-xs font-medium"
                  >
                    {topic}
                  </div>
                ))}
              </div>
            </div>

            {/* Next Lesson */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Next Lesson</h3>
              <div className="rounded-lg bg-sakura-light border border-sakura/20 p-4">
                <p className="text-sm font-medium text-foreground">Polite forms (〜ます)</p>
                <p className="text-xs text-muted-foreground mt-1">
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
