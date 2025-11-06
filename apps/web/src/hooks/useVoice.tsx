"use client"

import { useEffect, useRef, useCallback, useState, useMemo } from "react"
import { io, type Socket } from "socket.io-client"
// Use dynamic import for jnaudiostream to avoid type resolution issues during lint/build
import { useAuth } from "@clerk/nextjs"
import { env } from "~/env"
import { AudioStreamer, type Options } from "jnaudiostream"
import { AudioRecorder } from "~/lib/AudioRecorder"

type ConnectionState = "disconnected" | "connecting" | "connected" | "error"

// Color mapping for console.log tags
const LOG_TAG_COLORS: Record<string, string> = {
  // SocketIOManager methods - Blue-green spectrum
  "[SocketIOManager.constructor]": "#0066cc",
  "[SocketIOManager.setTokenGetter]": "#0080cc",
  "[SocketIOManager.setState]": "#0099cc",
  "[SocketIOManager.connect]": "#00aacc",
  "[SocketIOManager.disconnect]": "#00bbcc",
  "[SocketIOManager.startStreaming]": "#00cccc",
  "[SocketIOManager.stopStreaming]": "#00bbaa",
  "[SocketIOManager.isRecording]": "#00aa99",
  "[SocketIOManager.ensureStreamer]": "#009988",
  "[SocketIOManager.resetStreamer]": "#008877",
  "[SocketIOManager.subscribeState]": "#007766",
  "[SocketIOManager.subscribeMessages]": "#2288aa",
  "[SocketIOManager.subscribeRecording]": "#44aa88",
  "[SocketIOManager.subscribeTransition]": "#66bb88",
  "[SocketIOManager.notifyTransitionSubscribers]": "#88cc99",
  "[SocketIOManager.subscribeErrors]": "#aaddaa",
  "[SocketIOManager.incrementHookCount]": "#66dd88",
  "[SocketIOManager.decrementHookCount]": "#44cc99",
  "[SocketIOManager.getActiveHookCount]": "#22bbaa",
  "[SocketIOManager.getState]": "#44ccbb",
  "[SocketIOManager.isConnected]": "#66ddcc",
  // SocketIOManager event handlers - Purple spectrum
  "[SocketIOManager|on('connect')]": "#6600cc",
  "[SocketIOManager|on('disconnect')]": "#7700dd",
  "[SocketIOManager|on('connect_error')]": "#8800ee",
  "[SocketIOManager|on('bufferHeader')]": "#9900ff",
  "[SocketIOManager|on('stream')]": "#aa00ff",
  // SocketIOManager.startStreaming sub-handlers
  "[SocketIOManager.startStreaming|handleHeader]": "#bb00ff",
  "[SocketIOManager.startStreaming|handleBuffer]": "#cc00ff",
  "[SocketIOManager.startStreaming|handleRecordingStateChange]": "#dd00ff",
  // useVoice hooks - Orange-red spectrum
  "[useVoice|useEffect]": "#ff6600",
  "[useVoice|tokenGetter]": "#ff5500",
  "[useVoice|stateCallback]": "#ff4400",
  "[useVoice|messageCallback]": "#ff3300",
  "[useVoice|errorCallback]": "#ff2200",
  "[useVoice|recordingCallback]": "#ff1100",
  "[useVoice|transitionCallback]": "#ff0000",
  "[useVoice.startStreaming]": "#ff0066",
  "[useVoice.stopStreaming]": "#ff0055",
  "[useVoice.connect]": "#ff0044",
  "[useVoice.disconnect]": "#ff0033",
}

// Helper function to format console.log with colored tag
function formatLog(
  tag: string,
  message: string,
  ...args: unknown[]
): [string, string, ...unknown[]] {
  const color = LOG_TAG_COLORS[tag] ?? "#666666"
  return [`%c${tag}%c ${message}`, `color: ${color}`, "", ...args]
}

interface UseVoiceOptions {
  onVoiceData?: (data: ArrayBuffer) => void
  onError?: (error: Error) => void
  onStateChange?: (state: ConnectionState) => void
  autoConnect?: boolean
}

// Singleton Socket.IO connection manager
class SocketIOManager {
  private socketUnavailable = false
  private socket: Socket | null = null
  private state: ConnectionState = "disconnected"
  private subscribers = new Set<(state: ConnectionState) => void>()
  private messageHandlers = new Set<(data: ArrayBuffer) => void>()
  private errorHandlers = new Set<(error: Error) => void>()
  private getToken: (() => Promise<string | null>) | null = null
  private url = ""
  private activeHooks = 0 // Track number of active hook instances
  // Minimal typed interfaces for jnaudiostream usage
  private recorder: AudioRecorder | null = null
  private streamer: AudioStreamer | null = null
  private recordingSubscribers = new Set<(recording: boolean) => void>()
  private transitionSubscribers = new Set<(transitioning: boolean) => void>()
  private shouldPlayOnHeader = false
  private starting = false

  constructor() {
    console.log(...formatLog("[SocketIOManager.constructor]", "Initializing SocketIOManager"))
    // Determine Socket.IO URL based on current location
    if (!env.NEXT_PUBLIC_WEBSOCKET_SERVER_URL) {
      console.log(
        ...formatLog("[SocketIOManager.constructor]", "Socket unavailable - no URL configured"),
      )
      this.socketUnavailable = true
      return
    }
    this.url = env.NEXT_PUBLIC_WEBSOCKET_SERVER_URL
    console.log(
      ...formatLog(
        "[SocketIOManager.constructor]",
        "SocketIOManager initialized with URL:",
        this.url,
      ),
    )
  }

  setTokenGetter(getToken: () => Promise<string | null>) {
    console.log(...formatLog("[SocketIOManager.setTokenGetter]", "Setting token getter"))
    this.getToken = getToken
  }

  private setState(newState: ConnectionState) {
    console.log(
      ...formatLog("[SocketIOManager.setState]", "setState() called with newState:", newState),
    )
    if (this.state !== newState) {
      console.log(
        ...formatLog("[SocketIOManager.setState]", "State changing:", this.state, "->", newState),
      )
      this.state = newState
      console.log(
        ...formatLog(
          "[SocketIOManager.setState]",
          "Notifying",
          this.subscribers.size,
          "subscribers",
        ),
      )
      this.subscribers.forEach((callback) => callback(newState))
    } else {
      console.log(...formatLog("[SocketIOManager.setState]", "State unchanged:", newState))
    }
  }

  async connect() {
    if (this.socketUnavailable) {
      console.log(...formatLog("[SocketIOManager.connect]", "Socket is unavailable"))
      return
    }

    if (this.socket?.connected) {
      console.log(...formatLog("[SocketIOManager.connect]", "Socket is already connected"))
      return
    }
    if (this.state === "connecting" || this.state === "connected") {
      console.log(...formatLog("[SocketIOManager.connect]", "Connection already in progress"))
      return
    }

    if (!this.getToken) {
      console.error(...formatLog("[SocketIOManager.connect]", "Token getter not set"))
      this.setState("error")
      return
    }

    this.setState("connecting")

    try {
      // Get Clerk session token
      const token = await this.getToken()

      if (!token) {
        console.error(
          ...formatLog("[SocketIOManager.connect]", "No authentication token available"),
        )
        throw new Error("No authentication token available")
      }

      console.log(...formatLog("[SocketIOManager.connect]", "Attempting to connect to:", this.url))

      // Disconnect existing socket if any
      if (this.socket) {
        this.socket.disconnect()
        this.socket.removeAllListeners()
      }

      // Create new Socket.IO connection with authentication
      this.socket = io(this.url, {
        auth: {
          token: token,
        },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      })

      this.socket.on("connect", () => {
        console.log(
          ...formatLog("[SocketIOManager|on('connect')]", "Connection opened successfully"),
        )
        this.setState("connected")
      })

      this.socket.on("disconnect", (reason) => {
        console.log(
          ...formatLog("[SocketIOManager|on('disconnect')]", "Connection closed:", reason),
        )
        this.setState("disconnected")
      })

      this.socket.on("connect_error", (error) => {
        console.error(
          ...formatLog("[SocketIOManager|on('connect_error')]", "Connection error:", error),
        )
        this.errorHandlers.forEach((handler) => handler(error))
        this.setState("error")
      })

      // jnaudiostream events: route to AudioStreamer
      this.socket.on(
        "bufferHeader",
        async (packet: { mimeType: string; data: ArrayBuffer; startTime: number }) => {
          console.log(
            ...formatLog(
              "[SocketIOManager|on('bufferHeader')]",
              "Received bufferHeader:",
              packet?.mimeType,
            ),
          )
          await this.ensureStreamer()
          // Ignore if no active start/recording session (prevents stale events post-stop)
          const isRecording = this.isRecording()
          const isStarting = this.starting
          const isActive = isStarting || isRecording
          console.log(
            ...formatLog(
              "[SocketIOManager|on('bufferHeader')]",
              "Active session check - starting:",
              isStarting,
              "isRecording:",
              isRecording,
              "isActive:",
              isActive,
            ),
          )
          if (!isActive) {
            console.log(
              ...formatLog(
                "[SocketIOManager|on('bufferHeader')]",
                "No active session, ignoring bufferHeader",
              ),
            )
            return
          }
          console.log(...formatLog("[SocketIOManager|on('bufferHeader')]", "Setting buffer header"))
          this.streamer!.setBufferHeader(packet)
          // Begin playback only after header to avoid AbortError from new load during play
          console.log(
            ...formatLog(
              "[SocketIOManager|on('bufferHeader')]",
              "shouldPlayOnHeader:",
              this.shouldPlayOnHeader,
            ),
          )
          if (this.shouldPlayOnHeader) {
            console.log(
              ...formatLog("[SocketIOManager|on('bufferHeader')]", "Attempting to play stream"),
            )
            try {
              this.streamer!.playStream()
              this.shouldPlayOnHeader = false
              console.log(
                ...formatLog(
                  "[SocketIOManager|on('bufferHeader')]",
                  "Stream playback started successfully",
                ),
              )
            } catch (error) {
              console.log(
                ...formatLog(
                  "[SocketIOManager|on('bufferHeader')]",
                  "playStream() failed after header, waiting for next user gesture:",
                  error,
                ),
              )
              const retry = () => {
                console.log(
                  ...formatLog(
                    "[SocketIOManager|on('bufferHeader')]",
                    "Retrying playStream on user gesture",
                  ),
                )
                try {
                  this.streamer!.playStream()
                  this.shouldPlayOnHeader = false
                  console.log(
                    ...formatLog("[SocketIOManager|on('bufferHeader')]", "Retry successful"),
                  )
                } catch (e) {
                  console.log(
                    ...formatLog(
                      "[SocketIOManager|on('bufferHeader')]",
                      "playStream() retry failed on gesture:",
                      e,
                    ),
                  )
                } finally {
                  window.removeEventListener("pointerdown", retry, { capture: true })
                  window.removeEventListener("keydown", retry, { capture: true })
                  window.removeEventListener("click", retry, { capture: true })
                }
              }
              window.addEventListener("pointerdown", retry, { once: true, capture: true })
              window.addEventListener("keydown", retry, { once: true, capture: true })
              window.addEventListener("click", retry, { once: true, capture: true })
            }
          }
        },
      )

      this.socket.on("stream", async (packet: [ArrayBuffer, number]) => {
        console.log(
          ...formatLog(
            "[SocketIOManager|on('stream')]",
            "Received stream packet, ArrayBuffer length:",
            packet[0].byteLength,
          ),
        )
        await this.ensureStreamer()
        // Ignore if no active start/recording session
        const isRecording = this.isRecording()
        const isStarting = this.starting
        const isActive = isStarting || isRecording
        console.log(
          ...formatLog(
            "[SocketIOManager|on('stream')]",
            "Active session check - starting:",
            isStarting,
            "isRecording:",
            isRecording,
            "isActive:",
            isActive,
          ),
        )
        if (!isActive) {
          console.log(
            ...formatLog(
              "[SocketIOManager|on('stream')]",
              "No active session, ignoring stream packet",
            ),
          )
          return
        }
        console.log(
          ...formatLog("[SocketIOManager|on('stream')]", "Forwarding stream buffer to streamer"),
        )
        this.streamer?.receiveBuffer(packet)
      })

      // Handle ping/pong
      this.socket.on("pong", () => {
        // Connection is alive
      })

      // Handle general errors
      this.socket.on("error", (error: Error) => {
        console.error("[Socket.IO] Socket error:", error)
        const errorObj = error instanceof Error ? error : new Error("Socket.IO error")
        this.errorHandlers.forEach((handler) => handler(errorObj))
        this.setState("error")
      })
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error("Failed to create Socket.IO connection")
      this.errorHandlers.forEach((handler) => handler(errorObj))
      this.setState("error")
    }
  }

  disconnect() {
    console.log(...formatLog("[SocketIOManager.disconnect]", "disconnect() called"))
    if (this.socketUnavailable) {
      console.log(...formatLog("[SocketIOManager.disconnect]", "Socket is unavailable"))
      return
    }
    if (this.socket) {
      console.log(...formatLog("[SocketIOManager.disconnect]", "Disconnecting socket"))
      this.socket.disconnect()
      this.socket.removeAllListeners()
      this.socket = null
    } else {
      console.log(...formatLog("[SocketIOManager.disconnect]", "No socket to disconnect"))
    }

    this.setState("disconnected")
    // Ensure audio streamer is stopped/reset as well
    if (this.streamer) {
      console.log(...formatLog("[SocketIOManager.disconnect]", "Stopping streamer"))
      try {
        this.streamer.stop()
      } catch (error) {
        console.log(
          ...formatLog(
            "[SocketIOManager.disconnect]",
            "streamer.stop() failed during disconnect:",
            error,
          ),
        )
      }
      this.streamer = null
    }
    this.shouldPlayOnHeader = false
    console.log(...formatLog("[SocketIOManager.disconnect]", "Disconnect complete"))
  }

  // jnaudiostream: start/stop microphone streaming
  async startStreaming(bufferDurationMs = 500, options?: Options) {
    if (this.socketUnavailable) {
      console.log(...formatLog("[SocketIOManager.startStreaming]", "Socket is unavailable"))
      return
    }
    console.log(...formatLog("[SocketIOManager.startStreaming]", "startStreaming() called"))
    if (this.starting) {
      console.log(
        ...formatLog(
          "[SocketIOManager.startStreaming]",
          "start ignored: transition in progress (starting)",
        ),
      )
      return
    }
    if (this.isRecording()) {
      console.log(...formatLog("[SocketIOManager.startStreaming]", "already recording"))
      return
    }
    if (!this.socket?.connected) {
      console.log(...formatLog("[SocketIOManager.startStreaming]", "not connected to socket"))
      return
    }

    // Ensure a fresh streamer for this session; playback will begin after header
    console.log(...formatLog("[SocketIOManager.startStreaming]", "resetting streamer"))
    // Ensure previous recorder (if any) is stopped before starting a new one
    try {
      this.recorder?.stopRecording()
    } catch (error) {
      console.log(
        ...formatLog(
          "[SocketIOManager.startStreaming]",
          "recorder.stopRecording() before restart failed:",
          error,
        ),
      )
    }
    this.recorder = null

    this.starting = true
    this.notifyTransitionSubscribers()
    await this.resetStreamer()
    console.log(...formatLog("[SocketIOManager.startStreaming]", "ensuring streamer"))
    await this.ensureStreamer()
    // Mark to start playback when header arrives (safer than playing before header)
    this.shouldPlayOnHeader = true

    console.log(...formatLog("[SocketIOManager.startStreaming]", "initializing recorder"))
    // Initialize recorder
    this.recorder = new AudioRecorder(options, bufferDurationMs)
    this.recorder.debug = false

    // Header callback (library names vary: support both)
    const handleHeader: AudioRecorder["onReady"] = (packet) => {
      console.log(
        ...formatLog(
          "[SocketIOManager.startStreaming|handleHeader]",
          "Forwarding header to server",
        ),
      )
      // Forward header to server
      this.socket?.emit("bufferHeader", packet)
    }

    const handleBuffer: AudioRecorder["onBuffer"] = (packet) => {
      console.log(
        ...formatLog(
          "[SocketIOManager.startStreaming|handleBuffer]",
          "Forwarding audio chunk to server",
        ),
      )
      // Forward audio chunks to server
      this.socket?.emit("stream", packet)
    }

    const handleRecordingStateChange: AudioRecorder["onRecordingStateChange"] = (recording) => {
      console.log(
        ...formatLog(
          "[SocketIOManager.startStreaming|handleRecordingStateChange]",
          "Recording state changed:",
          recording,
        ),
      )
      this.recordingSubscribers.forEach((cb) => cb(recording))
    }

    this.recorder.onReady = handleHeader
    this.recorder.onBuffer = handleBuffer
    this.recorder.onRecordingStateChange = handleRecordingStateChange
    // Streamer already ensured and started above
    console.log(...formatLog("[SocketIOManager.startStreaming]", "starting recording"))
    try {
      const startRecordingResult = await this.recorder.startRecording()
      console.log(
        ...formatLog(
          "[SocketIOManager.startStreaming]",
          "startRecording() result:",
          startRecordingResult,
        ),
      )
      if (startRecordingResult) {
        console.log(
          ...formatLog(
            "[SocketIOManager.startStreaming]",
            "Notifying",
            this.recordingSubscribers.size,
            "recording subscribers",
          ),
        )
      }
    } catch (e) {
      console.error(
        ...formatLog("[SocketIOManager.startStreaming]", "Failed to start recording:", e),
      )
      const err = e instanceof Error ? e : new Error("Failed to start recording.")
      console.log(
        ...formatLog(
          "[SocketIOManager.startStreaming]",
          "Notifying",
          this.errorHandlers.size,
          "error handlers",
        ),
      )
      this.errorHandlers.forEach((handler) => handler(err))
      // Best effort stop if partially started
      try {
        console.log(
          ...formatLog(
            "[SocketIOManager.startStreaming]",
            "Attempting to stop recorder after error",
          ),
        )
        this.recorder.stopRecording()
      } catch (error) {
        console.log(
          ...formatLog(
            "[SocketIOManager.startStreaming]",
            "recorder.stopRecording() failed after start error:",
            error,
          ),
        )
      }
    } finally {
      console.log(
        ...formatLog("[SocketIOManager.startStreaming]", "Setting starting flag to false"),
      )
      this.starting = false
      this.notifyTransitionSubscribers()
    }
  }

  stopStreaming() {
    console.log(...formatLog("[SocketIOManager.stopStreaming]", "stopStreaming() called"))
    if (this.socketUnavailable) {
      console.log(...formatLog("[SocketIOManager.stopStreaming]", "Socket is unavailable"))
      return
    }

    const wasRecording = this.isRecording()
    console.log(...formatLog("[SocketIOManager.stopStreaming]", "Was recording:", wasRecording))
    if (this.recorder && wasRecording) {
      console.log(...formatLog("[SocketIOManager.stopStreaming]", "Stopping recorder"))
      this.recorder.stopRecording()
    } else {
      console.log(...formatLog("[SocketIOManager.stopStreaming]", "No recorder or not recording"))
    }
    // Stop and reset streamer so the next session doesn't interrupt current load/play
    if (this.streamer) {
      console.log(...formatLog("[SocketIOManager.stopStreaming]", "Stopping streamer"))
      try {
        this.streamer.stop()
        console.log(
          ...formatLog("[SocketIOManager.stopStreaming]", "Streamer stopped successfully"),
        )
      } catch (error) {
        console.log(
          ...formatLog(
            "[SocketIOManager.stopStreaming]",
            "streamer.stop() failed during stopStreaming:",
            error,
          ),
        )
      }
      this.streamer = null
    } else {
      console.log(...formatLog("[SocketIOManager.stopStreaming]", "No streamer to stop"))
    }
    this.recorder = null
    this.shouldPlayOnHeader = false

    console.log(...formatLog("[SocketIOManager.stopStreaming]", "stopStreaming() complete"))
  }

  isRecording(): boolean {
    const r = this.recorder
    if (!r) {
      console.log(...formatLog("[SocketIOManager.isRecording]", "No recorder, returning false"))
      return false
    }
    if (typeof r.recording === "boolean") {
      console.log(...formatLog("[SocketIOManager.isRecording]", "Recording state:", r.recording))
      return r.recording
    }
    const mr = r.mediaRecorder
    const isRecording = mr?.state === "recording"
    console.log(
      ...formatLog(
        "[SocketIOManager.isRecording]",
        "MediaRecorder state:",
        mr?.state,
        "isRecording:",
        isRecording,
      ),
    )
    return isRecording
  }

  private async ensureStreamer() {
    console.log(...formatLog("[SocketIOManager.ensureStreamer]", "ensureStreamer() called"))
    if (!this.streamer) {
      console.log(...formatLog("[SocketIOManager.ensureStreamer]", "Creating new AudioStreamer"))
      this.streamer = new AudioStreamer(1000)
      this.streamer.debug = false
      console.log(...formatLog("[SocketIOManager.ensureStreamer]", "AudioStreamer created"))
    } else {
      console.log(...formatLog("[SocketIOManager.ensureStreamer]", "Streamer already exists"))
    }
  }

  // Stop and discard the current streamer instance, if any
  private async resetStreamer() {
    console.log(...formatLog("[SocketIOManager.resetStreamer]", "resetStreamer() called"))
    if (this.streamer) {
      console.log(...formatLog("[SocketIOManager.resetStreamer]", "Stopping existing streamer"))
      try {
        this.streamer.stop()
        console.log(
          ...formatLog("[SocketIOManager.resetStreamer]", "Streamer stopped successfully"),
        )
      } catch (error) {
        console.log(
          ...formatLog(
            "[SocketIOManager.resetStreamer]",
            "streamer.stop() failed during resetStreamer():",
            error,
          ),
        )
      }
      this.streamer = null
    } else {
      console.log(...formatLog("[SocketIOManager.resetStreamer]", "No streamer to reset"))
    }
  }

  subscribeState(callback: (state: ConnectionState) => void) {
    console.log(
      ...formatLog(
        "[SocketIOManager.subscribeState]",
        "subscribeState() called, current subscribers:",
        this.subscribers.size,
      ),
    )
    this.subscribers.add(callback)
    // Immediately call with current state
    console.log(
      ...formatLog(
        "[SocketIOManager.subscribeState]",
        "Calling callback with initial state:",
        this.state,
      ),
    )
    callback(this.state)
    console.log(
      ...formatLog(
        "[SocketIOManager.subscribeState]",
        "Subscriber added, total:",
        this.subscribers.size,
      ),
    )
    return () => {
      console.log(...formatLog("[SocketIOManager.subscribeState]", "Unsubscribing state callback"))
      this.subscribers.delete(callback)
    }
  }

  subscribeMessages(callback: (data: ArrayBuffer) => void) {
    console.log(
      ...formatLog(
        "[SocketIOManager.subscribeMessages]",
        "subscribeMessages() called, current handlers:",
        this.messageHandlers.size,
      ),
    )
    this.messageHandlers.add(callback)
    console.log(
      ...formatLog(
        "[SocketIOManager.subscribeMessages]",
        "Handler added, total:",
        this.messageHandlers.size,
      ),
    )
    return () => {
      console.log(
        ...formatLog("[SocketIOManager.subscribeMessages]", "Unsubscribing message handler"),
      )
      this.messageHandlers.delete(callback)
    }
  }

  subscribeRecording(callback: (recording: boolean) => void) {
    console.log(
      ...formatLog(
        "[SocketIOManager.subscribeRecording]",
        "subscribeRecording() called, current subscribers:",
        this.recordingSubscribers.size,
      ),
    )
    this.recordingSubscribers.add(callback)
    const currentRecording = this.isRecording()
    console.log(
      ...formatLog(
        "[SocketIOManager.subscribeRecording]",
        "Calling callback with initial recording state:",
        currentRecording,
      ),
    )
    callback(currentRecording)
    console.log(
      ...formatLog(
        "[SocketIOManager.subscribeRecording]",
        "Subscriber added, total:",
        this.recordingSubscribers.size,
      ),
    )
    return () => {
      console.log(
        ...formatLog("[SocketIOManager.subscribeRecording]", "Unsubscribing recording callback"),
      )
      this.recordingSubscribers.delete(callback)
    }
  }

  subscribeTransition(callback: (transitioning: boolean) => void) {
    console.log(
      ...formatLog(
        "[SocketIOManager.subscribeTransition]",
        "subscribeTransition() called, current subscribers:",
        this.transitionSubscribers.size,
      ),
    )
    this.transitionSubscribers.add(callback)
    console.log(
      ...formatLog(
        "[SocketIOManager.subscribeTransition]",
        "Calling callback with initial transition state:",
        this.starting,
      ),
    )
    callback(this.starting)
    console.log(
      ...formatLog(
        "[SocketIOManager.subscribeTransition]",
        "Subscriber added, total:",
        this.transitionSubscribers.size,
      ),
    )
    return () => {
      console.log(
        ...formatLog("[SocketIOManager.subscribeTransition]", "Unsubscribing transition callback"),
      )
      this.transitionSubscribers.delete(callback)
    }
  }

  private notifyTransitionSubscribers() {
    console.log(
      ...formatLog(
        "[SocketIOManager.notifyTransitionSubscribers]",
        "Notifying",
        this.transitionSubscribers.size,
        "transition subscribers with state:",
        this.starting,
      ),
    )
    this.transitionSubscribers.forEach((callback) => callback(this.starting))
  }

  subscribeErrors(callback: (error: Error) => void) {
    console.log(
      ...formatLog(
        "[SocketIOManager.subscribeErrors]",
        "subscribeErrors() called, current handlers:",
        this.errorHandlers.size,
      ),
    )
    this.errorHandlers.add(callback)
    console.log(
      ...formatLog(
        "[SocketIOManager.subscribeErrors]",
        "Handler added, total:",
        this.errorHandlers.size,
      ),
    )
    return () => {
      console.log(...formatLog("[SocketIOManager.subscribeErrors]", "Unsubscribing error handler"))
      this.errorHandlers.delete(callback)
    }
  }

  // Increment hook usage counter
  incrementHookCount() {
    console.log(
      ...formatLog(
        "[SocketIOManager.incrementHookCount]",
        "incrementHookCount() called, current:",
        this.activeHooks,
      ),
    )
    this.activeHooks++
    console.log(
      ...formatLog("[SocketIOManager.incrementHookCount]", "Active hooks now:", this.activeHooks),
    )
  }

  // Decrement hook usage counter and disconnect if no hooks remain
  decrementHookCount() {
    console.log(
      ...formatLog(
        "[SocketIOManager.decrementHookCount]",
        "decrementHookCount() called, current:",
        this.activeHooks,
      ),
    )
    this.activeHooks--
    if (this.activeHooks <= 0) {
      console.log(
        ...formatLog(
          "[SocketIOManager.decrementHookCount]",
          "No active hooks remaining, disconnecting",
        ),
      )
      this.activeHooks = 0 // Prevent negative counts
      // Disconnect when no hooks are using the connection
      this.disconnect()
    } else {
      console.log(
        ...formatLog(
          "[SocketIOManager.decrementHookCount]",
          "Active hooks remaining:",
          this.activeHooks,
        ),
      )
    }
  }
}

// Singleton instance
const socketManager = new SocketIOManager()

const useVoice = (options: UseVoiceOptions = {}) => {
  const { onVoiceData, onError, onStateChange, autoConnect = true } = options
  const { getToken } = useAuth()

  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected")
  const [recording, setRecording] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const onVoiceDataRef = useRef(onVoiceData)
  const onErrorRef = useRef(onError)
  const onStateChangeRef = useRef(onStateChange)

  // Keep refs updated
  useEffect(() => {
    console.log(...formatLog("[useVoice|useEffect]", "Updating callback refs"))
    onVoiceDataRef.current = onVoiceData
    onErrorRef.current = onError
    onStateChangeRef.current = onStateChange
  }, [onVoiceData, onError, onStateChange])

  // Set token getter when available
  useEffect(() => {
    console.log(
      ...formatLog("[useVoice|useEffect]", "Setting token getter, getToken available:", !!getToken),
    )
    if (getToken) {
      socketManager.setTokenGetter(async () => {
        console.log(...formatLog("[useVoice|tokenGetter]", "Getting token"))
        try {
          const token = await getToken()
          console.log(...formatLog("[useVoice|tokenGetter]", "Token retrieved:", !!token))
          return token
        } catch (error) {
          console.error(...formatLog("[useVoice|tokenGetter]", "Failed to get token:", error))
          return null
        }
      })
    }
  }, [getToken])

  // Subscribe to connection state changes
  useEffect(() => {
    console.log(...formatLog("[useVoice|useEffect]", "Subscribing to connection state changes"))
    const unsubscribe = socketManager.subscribeState((state) => {
      console.log(...formatLog("[useVoice|stateCallback]", "Connection state changed:", state))
      setConnectionState(state)
      onStateChangeRef.current?.(state)
    })

    return () => {
      console.log(...formatLog("[useVoice|useEffect]", "Cleaning up connection state subscription"))
      unsubscribe()
    }
  }, [])

  // Subscribe to incoming voice data
  useEffect(() => {
    console.log(
      ...formatLog(
        "[useVoice|useEffect]",
        "Setting up voice data subscription, has callback:",
        !!onVoiceDataRef.current,
      ),
    )
    if (!onVoiceDataRef.current) {
      console.log(
        ...formatLog("[useVoice|useEffect]", "No voice data callback, skipping subscription"),
      )
      return
    }

    const unsubscribe = socketManager.subscribeMessages((data) => {
      console.log(
        ...formatLog("[useVoice|messageCallback]", "Received voice data, size:", data.byteLength),
      )
      onVoiceDataRef.current?.(data)
    })

    return () => {
      console.log(...formatLog("[useVoice|useEffect]", "Cleaning up voice data subscription"))
      unsubscribe()
    }
  }, [])

  // Subscribe to errors
  useEffect(() => {
    console.log(
      ...formatLog(
        "[useVoice|useEffect]",
        "Setting up error subscription, has callback:",
        !!onErrorRef.current,
      ),
    )
    if (!onErrorRef.current) {
      console.log(...formatLog("[useVoice|useEffect]", "No error callback, skipping subscription"))
      return
    }

    const unsubscribe = socketManager.subscribeErrors((error) => {
      console.log(...formatLog("[useVoice|errorCallback]", "Error received:", error.message))
      onErrorRef.current?.(error)
    })

    return () => {
      console.log(...formatLog("[useVoice|useEffect]", "Cleaning up error subscription"))
      unsubscribe()
    }
  }, [])

  // Subscribe to recording state changes
  useEffect(() => {
    console.log(...formatLog("[useVoice|useEffect]", "Subscribing to recording state changes"))
    const unsubscribe = socketManager.subscribeRecording((r) => {
      console.log(...formatLog("[useVoice|recordingCallback]", "Recording state changed:", r))
      setRecording(r)
    })
    return () => {
      console.log(...formatLog("[useVoice|useEffect]", "Cleaning up recording state subscription"))
      unsubscribe()
    }
  }, [])

  // Subscribe to transition state changes
  useEffect(() => {
    console.log(...formatLog("[useVoice|useEffect]", "Subscribing to transition state changes"))
    const unsubscribe = socketManager.subscribeTransition((transitioning) => {
      console.log(
        ...formatLog("[useVoice|transitionCallback]", "Transition state changed:", transitioning),
      )
      setIsTransitioning(transitioning)
    })
    return () => {
      console.log(...formatLog("[useVoice|useEffect]", "Cleaning up transition state subscription"))
      unsubscribe()
    }
  }, [])

  // Track hook instance and manage connection lifecycle
  useEffect(() => {
    console.log(
      ...formatLog("[useVoice|useEffect]", "Setting up hook lifecycle, autoConnect:", autoConnect),
    )
    socketManager.incrementHookCount()

    if (autoConnect) {
      console.log(...formatLog("[useVoice|useEffect]", "Auto-connect enabled, connecting..."))
      void socketManager.connect()
    } else {
      console.log(
        ...formatLog("[useVoice|useEffect]", "Auto-connect disabled, skipping connection"),
      )
    }

    // Cleanup on unmount - decrement counter and disconnect if last hook
    return () => {
      console.log(...formatLog("[useVoice|useEffect]", "Cleaning up hook lifecycle"))
      socketManager.decrementHookCount()
    }
  }, [autoConnect])

  const startStreaming = useCallback((bufferDurationMs?: number, options?: Options) => {
    console.log(
      ...formatLog(
        "[useVoice.startStreaming]",
        "startStreaming() called, bufferDurationMs:",
        bufferDurationMs,
        "options:",
        options,
      ),
    )
    return socketManager.startStreaming(bufferDurationMs, options)
  }, [])

  const stopStreaming = useCallback(() => {
    console.log(...formatLog("[useVoice.stopStreaming]", "stopStreaming() called"))
    socketManager.stopStreaming()
  }, [])

  const connect = useCallback(() => {
    console.log(...formatLog("[useVoice.connect]", "connect() called"))
    void socketManager.connect()
  }, [])

  const disconnect = useCallback(() => {
    console.log(...formatLog("[useVoice.disconnect]", "disconnect() called"))
    socketManager.disconnect()
  }, [])

  const micState = useMemo<"idle" | "pending" | "listening">(() => {
    // "listening" when recording
    if (recording) {
      return "listening"
    }
    // "pending" during transitions or when connecting
    if (isTransitioning || connectionState === "connecting") {
      return "pending"
    }
    // "idle" otherwise
    return "idle"
  }, [recording, isTransitioning, connectionState])

  return {
    connectionState,
    isConnected: connectionState === "connected",
    startStreaming,
    stopStreaming,
    isRecording: recording,
    connect,
    disconnect,
    micState,
  }
}

export default useVoice
