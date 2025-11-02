import { Mastra } from "@mastra/core/mastra"
import { PinoLogger } from "@mastra/loggers"

import { japaneseTutorAgent } from "./agents/japanese-tutor-agent"

export const mastra = new Mastra({
  agents: { japaneseTutorAgent },
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
  telemetry: {
    // Telemetry is deprecated and will be removed in the Nov 4th release
    enabled: false,
  },
  observability: {
    // Enables DefaultExporter and CloudExporter for AI tracing
    default: { enabled: true },
  },
})
