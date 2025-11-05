"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { io, type Socket } from "socket.io-client"
// Use dynamic import for jnaudiostream to avoid type resolution issues during lint/build
import { useAuth } from "@clerk/nextjs"
import { env } from "~/env"
import { AudioRecorder, AudioStreamer, type Options } from "jnaudiostream"

type ConnectionState = "disconnected" | "connecting" | "connected" | "error"

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
  private shouldPlayOnHeader = false
  private starting = false
  private stopping = false

  constructor() {
    console.log("[SocketIOManager.constructor] Initializing SocketIOManager")
    // Determine Socket.IO URL based on current location
    if (!env.NEXT_PUBLIC_WEBSOCKET_SERVER_URL) {
      console.log("[SocketIOManager.constructor] Socket unavailable - no URL configured")
      this.socketUnavailable = true
      return
    }
    this.url = env.NEXT_PUBLIC_WEBSOCKET_SERVER_URL
    console.log("[SocketIOManager.constructor] SocketIOManager initialized with URL:", this.url)
  }

  setTokenGetter(getToken: () => Promise<string | null>) {
    console.log("[SocketIOManager.setTokenGetter] Setting token getter")
    this.getToken = getToken
  }

  private setState(newState: ConnectionState) {
    console.log("[SocketIOManager.setState] setState() called with newState:", newState)
    if (this.state !== newState) {
      console.log("[SocketIOManager.setState] State changing:", this.state, "->", newState)
      this.state = newState
      console.log("[SocketIOManager.setState] Notifying", this.subscribers.size, "subscribers")
      this.subscribers.forEach((callback) => callback(newState))
    } else {
      console.log("[SocketIOManager.setState] State unchanged:", newState)
    }
  }

  async connect() {
    if (this.socketUnavailable) {
      console.log("[SocketIOManager.connect] Socket is unavailable")
      return
    }

    if (this.socket?.connected) {
      console.log("[SocketIOManager.connect] Socket is already connected")
      return
    }

    if (!this.getToken) {
      console.error("[SocketIOManager.connect] Token getter not set")
      this.setState("error")
      return
    }

    this.setState("connecting")

    try {
      // Get Clerk session token
      const token = await this.getToken()

      if (!token) {
        console.error("[SocketIOManager.connect] No authentication token available")
        throw new Error("No authentication token available")
      }

      console.log("[SocketIOManager.connect] Attempting to connect to:", this.url)

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
        console.log("[SocketIOManager|on('connect')] Connection opened successfully")
        this.setState("connected")
      })

      this.socket.on("disconnect", (reason) => {
        console.log("[SocketIOManager|on('disconnect')] Connection closed:", reason)
        this.setState("disconnected")
      })

      this.socket.on("connect_error", (error) => {
        console.error("[SocketIOManager|on('connect_error')] Connection error:", error)
        this.errorHandlers.forEach((handler) => handler(error))
        this.setState("error")
      })

      // jnaudiostream events: route to AudioStreamer
      this.socket.on(
        "bufferHeader",
        async (packet: { mimeType: string; data: ArrayBuffer; startTime: number }) => {
          console.log(
            "[SocketIOManager|on('bufferHeader')] Received bufferHeader:",
            packet?.mimeType,
          )
          await this.ensureStreamer()
          // Ignore if no active start/recording session (prevents stale events post-stop)
          const isActive = this.starting || this.isRecording()
          console.log(
            "[SocketIOManager|on('bufferHeader')] Active session check - starting:",
            this.starting,
            "isRecording:",
            this.isRecording(),
            "isActive:",
            isActive,
          )
          if (!isActive) {
            console.log(
              "[SocketIOManager|on('bufferHeader')] No active session, ignoring bufferHeader",
            )
            return
          }
          console.log("[SocketIOManager|on('bufferHeader')] Setting buffer header")
          this.streamer!.setBufferHeader(packet)
          // Begin playback only after header to avoid AbortError from new load during play
          console.log(
            "[SocketIOManager|on('bufferHeader')] shouldPlayOnHeader:",
            this.shouldPlayOnHeader,
          )
          if (this.shouldPlayOnHeader) {
            console.log("[SocketIOManager|on('bufferHeader')] Attempting to play stream")
            try {
              this.streamer!.playStream()
              this.shouldPlayOnHeader = false
              console.log(
                "[SocketIOManager|on('bufferHeader')] Stream playback started successfully",
              )
            } catch (error) {
              console.log(
                "[SocketIOManager|on('bufferHeader')] playStream() failed after header, waiting for next user gesture:",
                error,
              )
              const retry = () => {
                console.log(
                  "[SocketIOManager|on('bufferHeader')] Retrying playStream on user gesture",
                )
                try {
                  this.streamer!.playStream()
                  this.shouldPlayOnHeader = false
                  console.log("[SocketIOManager|on('bufferHeader')] Retry successful")
                } catch (e) {
                  console.log(
                    "[SocketIOManager|on('bufferHeader')] playStream() retry failed on gesture:",
                    e,
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
          "[SocketIOManager|on('stream')] Received stream packet, ArrayBuffer length:",
          packet[0].byteLength,
        )
        await this.ensureStreamer()
        // Ignore if no active start/recording session
        const isActive = this.starting || this.isRecording()
        console.log(
          "[SocketIOManager|on('stream')] Active session check - starting:",
          this.starting,
          "isRecording:",
          this.isRecording(),
          "isActive:",
          isActive,
        )
        if (!isActive) {
          console.log("[SocketIOManager|on('stream')] No active session, ignoring stream packet")
          return
        }
        console.log("[SocketIOManager|on('stream')] Forwarding stream buffer to streamer")
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
    console.log("[SocketIOManager.disconnect] disconnect() called")
    if (this.socketUnavailable) {
      console.log("[SocketIOManager.disconnect] Socket is unavailable")
      return
    }
    if (this.socket) {
      console.log("[SocketIOManager.disconnect] Disconnecting socket")
      this.socket.disconnect()
      this.socket.removeAllListeners()
      this.socket = null
    } else {
      console.log("[SocketIOManager.disconnect] No socket to disconnect")
    }

    this.setState("disconnected")
    // Ensure audio streamer is stopped/reset as well
    if (this.streamer) {
      console.log("[SocketIOManager.disconnect] Stopping streamer")
      try {
        this.streamer.stop()
      } catch (error) {
        console.log("[SocketIOManager.disconnect] streamer.stop() failed during disconnect:", error)
      }
      this.streamer = null
    }
    this.shouldPlayOnHeader = false
    console.log("[SocketIOManager.disconnect] Disconnect complete")
  }

  // jnaudiostream: start/stop microphone streaming
  async startStreaming(bufferDurationMs = 500, options?: Options) {
    if (this.socketUnavailable) {
      console.log("[SocketIOManager.startStreaming] Socket is unavailable")
      return
    }
    console.log("[SocketIOManager.startStreaming] startStreaming() called")
    if (this.starting || this.stopping) {
      console.log(
        "[SocketIOManager.startStreaming] start ignored: transition in progress (starting/stopping)",
      )
      return
    }
    if (this.isRecording()) {
      console.log("[SocketIOManager.startStreaming] already recording")
      return
    }
    if (!this.socket?.connected) {
      console.log("[SocketIOManager.startStreaming] not connected to socket")
      return
    }

    // Ensure a fresh streamer for this session; playback will begin after header
    console.log("[SocketIOManager.startStreaming] resetting streamer")
    // Ensure previous recorder (if any) is stopped before starting a new one
    try {
      this.recorder?.stopRecording()
    } catch (error) {
      console.log(
        "[SocketIOManager.startStreaming] recorder.stopRecording() before restart failed:",
        error,
      )
    }
    this.recorder = null

    this.starting = true
    await this.resetStreamer()
    console.log("[SocketIOManager.startStreaming] ensuring streamer")
    await this.ensureStreamer()
    // Mark to start playback when header arrives (safer than playing before header)
    this.shouldPlayOnHeader = true

    console.log("[SocketIOManager.startStreaming] initializing recorder")
    // Initialize recorder
    this.recorder = new AudioRecorder(options, bufferDurationMs)
    this.recorder.debug = false

    // Header callback (library names vary: support both)
    const handleHeader: AudioRecorder["onReady"] = (packet) => {
      console.log("[SocketIOManager.startStreaming|handleHeader] Forwarding header to server")
      // Forward header to server
      this.socket?.emit("bufferHeader", packet)
    }

    const handleBuffer: AudioRecorder["onBuffer"] = (packet) => {
      console.log("[SocketIOManager.startStreaming|handleBuffer] Forwarding audio chunk to server")
      // Forward audio chunks to server
      this.socket?.emit("stream", packet)
    }

    this.recorder.onReady = handleHeader
    this.recorder.onBuffer = handleBuffer

    // Streamer already ensured and started above
    console.log("[SocketIOManager.startStreaming] starting recording")
    try {
      const startRecordingResult = await this.recorder.startRecording()
      console.log("[SocketIOManager.startStreaming] startRecording() result:", startRecordingResult)
      const recordingState = this.isRecording()
      console.log(
        "[SocketIOManager.startStreaming] Recording started successfully, state:",
        recordingState,
      )
      console.log(
        "[SocketIOManager.startStreaming] Notifying",
        this.recordingSubscribers.size,
        "recording subscribers",
      )
      this.recordingSubscribers.forEach((cb) => cb(recordingState))
    } catch (e) {
      const recordingState = this.isRecording()
      console.error("[SocketIOManager.startStreaming] Failed to start recording:", e)
      console.log(
        "[SocketIOManager.startStreaming] Notifying",
        this.recordingSubscribers.size,
        "recording subscribers of error state",
      )
      this.recordingSubscribers.forEach((cb) => cb(recordingState))
      const err = e instanceof Error ? e : new Error("Failed to start recording.")
      console.log(
        "[SocketIOManager.startStreaming] Notifying",
        this.errorHandlers.size,
        "error handlers",
      )
      this.errorHandlers.forEach((handler) => handler(err))
      // Best effort stop if partially started
      try {
        console.log("[SocketIOManager.startStreaming] Attempting to stop recorder after error")
        this.recorder.stopRecording()
      } catch (error) {
        console.log(
          "[SocketIOManager.startStreaming] recorder.stopRecording() failed after start error:",
          error,
        )
      }
    } finally {
      console.log("[SocketIOManager.startStreaming] Setting starting flag to false")
      this.starting = false
    }
  }

  stopStreaming() {
    console.log("[SocketIOManager.stopStreaming] stopStreaming() called")
    if (this.socketUnavailable) {
      console.log("[SocketIOManager.stopStreaming] Socket is unavailable")
      return
    }
    if (this.stopping) {
      console.log("[SocketIOManager.stopStreaming] stop ignored: already stopping")
      return
    }
    this.stopping = true
    const wasRecording = this.isRecording()
    console.log("[SocketIOManager.stopStreaming] Was recording:", wasRecording)
    if (this.recorder && wasRecording) {
      console.log("[SocketIOManager.stopStreaming] Stopping recorder")
      this.recorder.stopRecording()
    } else {
      console.log("[SocketIOManager.stopStreaming] No recorder or not recording")
    }
    const currentRecordingState = this.isRecording()
    console.log("[SocketIOManager.stopStreaming] Current recording state:", currentRecordingState)
    console.log(
      "[SocketIOManager.stopStreaming] Notifying",
      this.recordingSubscribers.size,
      "recording subscribers",
    )
    this.recordingSubscribers.forEach((cb) => cb(currentRecordingState))
    // Stop and reset streamer so the next session doesn't interrupt current load/play
    if (this.streamer) {
      console.log("[SocketIOManager.stopStreaming] Stopping streamer")
      try {
        this.streamer.stop()
        console.log("[SocketIOManager.stopStreaming] Streamer stopped successfully")
      } catch (error) {
        console.log(
          "[SocketIOManager.stopStreaming] streamer.stop() failed during stopStreaming:",
          error,
        )
      }
      this.streamer = null
    } else {
      console.log("[SocketIOManager.stopStreaming] No streamer to stop")
    }
    this.recorder = null
    this.shouldPlayOnHeader = false
    this.stopping = false
    console.log("[SocketIOManager.stopStreaming] stopStreaming() complete")
  }

  isRecording(): boolean {
    const r = this.recorder
    if (!r) {
      console.log("[SocketIOManager.isRecording] No recorder, returning false")
      return false
    }
    if (typeof r.recording === "boolean") {
      console.log("[SocketIOManager.isRecording] Recording state:", r.recording)
      return r.recording
    }
    const mr = r.mediaRecorder
    const isRecording = mr?.state === "recording"
    console.log(
      "[SocketIOManager.isRecording] MediaRecorder state:",
      mr?.state,
      "isRecording:",
      isRecording,
    )
    return isRecording
  }

  private async ensureStreamer() {
    console.log("[SocketIOManager.ensureStreamer] ensureStreamer() called")
    if (!this.streamer) {
      console.log("[SocketIOManager.ensureStreamer] Creating new AudioStreamer")
      this.streamer = new AudioStreamer(1000)
      this.streamer.debug = false
      console.log("[SocketIOManager.ensureStreamer] AudioStreamer created")
    } else {
      console.log("[SocketIOManager.ensureStreamer] Streamer already exists")
    }
  }

  // Stop and discard the current streamer instance, if any
  private async resetStreamer() {
    console.log("[SocketIOManager.resetStreamer] resetStreamer() called")
    if (this.streamer) {
      console.log("[SocketIOManager.resetStreamer] Stopping existing streamer")
      try {
        this.streamer.stop()
        console.log("[SocketIOManager.resetStreamer] Streamer stopped successfully")
      } catch (error) {
        console.log(
          "[SocketIOManager.resetStreamer] streamer.stop() failed during resetStreamer():",
          error,
        )
      }
      this.streamer = null
    } else {
      console.log("[SocketIOManager.resetStreamer] No streamer to reset")
    }
  }

  subscribeState(callback: (state: ConnectionState) => void) {
    console.log(
      "[SocketIOManager.subscribeState] subscribeState() called, current subscribers:",
      this.subscribers.size,
    )
    this.subscribers.add(callback)
    // Immediately call with current state
    console.log("[SocketIOManager.subscribeState] Calling callback with initial state:", this.state)
    callback(this.state)
    console.log("[SocketIOManager.subscribeState] Subscriber added, total:", this.subscribers.size)
    return () => {
      console.log("[SocketIOManager.subscribeState] Unsubscribing state callback")
      this.subscribers.delete(callback)
    }
  }

  subscribeMessages(callback: (data: ArrayBuffer) => void) {
    console.log(
      "[SocketIOManager.subscribeMessages] subscribeMessages() called, current handlers:",
      this.messageHandlers.size,
    )
    this.messageHandlers.add(callback)
    console.log(
      "[SocketIOManager.subscribeMessages] Handler added, total:",
      this.messageHandlers.size,
    )
    return () => {
      console.log("[SocketIOManager.subscribeMessages] Unsubscribing message handler")
      this.messageHandlers.delete(callback)
    }
  }

  subscribeRecording(callback: (recording: boolean) => void) {
    console.log(
      "[SocketIOManager.subscribeRecording] subscribeRecording() called, current subscribers:",
      this.recordingSubscribers.size,
    )
    this.recordingSubscribers.add(callback)
    const currentRecording = this.isRecording()
    console.log(
      "[SocketIOManager.subscribeRecording] Calling callback with initial recording state:",
      currentRecording,
    )
    callback(currentRecording)
    console.log(
      "[SocketIOManager.subscribeRecording] Subscriber added, total:",
      this.recordingSubscribers.size,
    )
    return () => {
      console.log("[SocketIOManager.subscribeRecording] Unsubscribing recording callback")
      this.recordingSubscribers.delete(callback)
    }
  }

  subscribeErrors(callback: (error: Error) => void) {
    console.log(
      "[SocketIOManager.subscribeErrors] subscribeErrors() called, current handlers:",
      this.errorHandlers.size,
    )
    this.errorHandlers.add(callback)
    console.log("[SocketIOManager.subscribeErrors] Handler added, total:", this.errorHandlers.size)
    return () => {
      console.log("[SocketIOManager.subscribeErrors] Unsubscribing error handler")
      this.errorHandlers.delete(callback)
    }
  }

  // Increment hook usage counter
  incrementHookCount() {
    console.log(
      "[SocketIOManager.incrementHookCount] incrementHookCount() called, current:",
      this.activeHooks,
    )
    this.activeHooks++
    console.log("[SocketIOManager.incrementHookCount] Active hooks now:", this.activeHooks)
  }

  // Decrement hook usage counter and disconnect if no hooks remain
  decrementHookCount() {
    console.log(
      "[SocketIOManager.decrementHookCount] decrementHookCount() called, current:",
      this.activeHooks,
    )
    this.activeHooks--
    if (this.activeHooks <= 0) {
      console.log("[SocketIOManager.decrementHookCount] No active hooks remaining, disconnecting")
      this.activeHooks = 0 // Prevent negative counts
      // Disconnect when no hooks are using the connection
      this.disconnect()
    } else {
      console.log("[SocketIOManager.decrementHookCount] Active hooks remaining:", this.activeHooks)
    }
  }

  getActiveHookCount(): number {
    console.log(
      "[SocketIOManager.getActiveHookCount] getActiveHookCount() called, returning:",
      this.activeHooks,
    )
    return this.activeHooks
  }

  getState(): ConnectionState {
    console.log("[SocketIOManager.getState] getState() called, returning:", this.state)
    return this.state
  }

  isConnected(): boolean {
    const connected = this.socket?.connected ?? false
    console.log("[SocketIOManager.isConnected] isConnected() called, returning:", connected)
    return connected
  }
}

// Singleton instance
const socketManager = new SocketIOManager()

const useVoice = (options: UseVoiceOptions = {}) => {
  const { onVoiceData, onError, onStateChange, autoConnect = true } = options
  const { getToken } = useAuth()

  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected")
  const [recording, setRecording] = useState(false)
  const onVoiceDataRef = useRef(onVoiceData)
  const onErrorRef = useRef(onError)
  const onStateChangeRef = useRef(onStateChange)

  // Keep refs updated
  useEffect(() => {
    console.log("[useVoice|useEffect] Updating callback refs")
    onVoiceDataRef.current = onVoiceData
    onErrorRef.current = onError
    onStateChangeRef.current = onStateChange
  }, [onVoiceData, onError, onStateChange])

  // Set token getter when available
  useEffect(() => {
    console.log("[useVoice|useEffect] Setting token getter, getToken available:", !!getToken)
    if (getToken) {
      socketManager.setTokenGetter(async () => {
        console.log("[useVoice|tokenGetter] Getting token")
        try {
          const token = await getToken()
          console.log("[useVoice|tokenGetter] Token retrieved:", !!token)
          return token
        } catch (error) {
          console.error("[useVoice|tokenGetter] Failed to get token:", error)
          return null
        }
      })
    }
  }, [getToken])

  // Subscribe to connection state changes
  useEffect(() => {
    console.log("[useVoice|useEffect] Subscribing to connection state changes")
    const unsubscribe = socketManager.subscribeState((state) => {
      console.log("[useVoice|stateCallback] Connection state changed:", state)
      setConnectionState(state)
      onStateChangeRef.current?.(state)
    })

    return () => {
      console.log("[useVoice|useEffect] Cleaning up connection state subscription")
      unsubscribe()
    }
  }, [])

  // Subscribe to incoming voice data
  useEffect(() => {
    console.log(
      "[useVoice|useEffect] Setting up voice data subscription, has callback:",
      !!onVoiceDataRef.current,
    )
    if (!onVoiceDataRef.current) {
      console.log("[useVoice|useEffect] No voice data callback, skipping subscription")
      return
    }

    const unsubscribe = socketManager.subscribeMessages((data) => {
      console.log("[useVoice|messageCallback] Received voice data, size:", data.byteLength)
      onVoiceDataRef.current?.(data)
    })

    return () => {
      console.log("[useVoice|useEffect] Cleaning up voice data subscription")
      unsubscribe()
    }
  }, [])

  // Subscribe to errors
  useEffect(() => {
    console.log(
      "[useVoice|useEffect] Setting up error subscription, has callback:",
      !!onErrorRef.current,
    )
    if (!onErrorRef.current) {
      console.log("[useVoice|useEffect] No error callback, skipping subscription")
      return
    }

    const unsubscribe = socketManager.subscribeErrors((error) => {
      console.log("[useVoice|errorCallback] Error received:", error.message)
      onErrorRef.current?.(error)
    })

    return () => {
      console.log("[useVoice|useEffect] Cleaning up error subscription")
      unsubscribe()
    }
  }, [])

  // Subscribe to recording state changes
  useEffect(() => {
    console.log("[useVoice|useEffect] Subscribing to recording state changes")
    const unsubscribe = socketManager.subscribeRecording((r) => {
      console.log("[useVoice|recordingCallback] Recording state changed:", r)
      setRecording(r)
    })
    return () => {
      console.log("[useVoice|useEffect] Cleaning up recording state subscription")
      unsubscribe()
    }
  }, [])

  // Track hook instance and manage connection lifecycle
  useEffect(() => {
    console.log("[useVoice|useEffect] Setting up hook lifecycle, autoConnect:", autoConnect)
    socketManager.incrementHookCount()

    if (autoConnect) {
      console.log("[useVoice|useEffect] Auto-connect enabled, connecting...")
      void socketManager.connect()
    } else {
      console.log("[useVoice|useEffect] Auto-connect disabled, skipping connection")
    }

    // Cleanup on unmount - decrement counter and disconnect if last hook
    return () => {
      console.log("[useVoice|useEffect] Cleaning up hook lifecycle")
      socketManager.decrementHookCount()
    }
  }, [autoConnect])

  const startStreaming = useCallback((bufferDurationMs?: number, options?: Options) => {
    console.log(
      "[useVoice.startStreaming] startStreaming() called, bufferDurationMs:",
      bufferDurationMs,
      "options:",
      options,
    )
    return socketManager.startStreaming(bufferDurationMs, options)
  }, [])

  const stopStreaming = useCallback(() => {
    console.log("[useVoice.stopStreaming] stopStreaming() called")
    socketManager.stopStreaming()
  }, [])

  const connect = useCallback(() => {
    console.log("[useVoice.connect] connect() called")
    void socketManager.connect()
  }, [])

  const disconnect = useCallback(() => {
    console.log("[useVoice.disconnect] disconnect() called")
    socketManager.disconnect()
  }, [])

  return {
    connectionState,
    isConnected: connectionState === "connected",
    startStreaming,
    stopStreaming,
    isRecording: recording,
    connect,
    disconnect,
  }
}

export default useVoice
