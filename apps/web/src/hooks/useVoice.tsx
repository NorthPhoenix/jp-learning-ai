"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { io, type Socket } from "socket.io-client"
// Use dynamic import for jnaudiostream to avoid type resolution issues during lint/build
import { useAuth } from "@clerk/nextjs"
import { env } from "~/env"

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
  private recorder: JNAudioRecorder | null = null
  private streamer: JNAudioStreamer | null = null
  private recordingSubscribers = new Set<(recording: boolean) => void>()
  private shouldPlayOnHeader = false
  private starting = false
  private stopping = false

  constructor() {
    // Determine Socket.IO URL based on current location
    if (!env.NEXT_PUBLIC_WEBSOCKET_SERVER_URL) {
      this.socketUnavailable = true
      return
    }
    this.url = env.NEXT_PUBLIC_WEBSOCKET_SERVER_URL
  }

  setTokenGetter(getToken: () => Promise<string | null>) {
    this.getToken = getToken
  }

  private setState(newState: ConnectionState) {
    if (this.state !== newState) {
      this.state = newState
      this.subscribers.forEach((callback) => callback(newState))
    }
  }

  async connect() {
    if (this.socketUnavailable) {
      console.log("[SocketIOManager.connect] Socket is unavailable")
      return
    }

    if (this.socket?.connected) {
      return
    }

    if (this.socket && !this.socket.disconnected) {
      return
    }

    if (!this.getToken) {
      console.error("[Socket.IO] Token getter not set")
      this.setState("error")
      return
    }

    this.setState("connecting")

    try {
      // Get Clerk session token
      const token = await this.getToken()

      if (!token) {
        throw new Error("No authentication token available")
      }

      console.log("[Socket.IO] Attempting to connect to:", this.url)

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
        console.log("[Socket.IO] Connection opened successfully")
        this.setState("connected")
      })

      this.socket.on("disconnect", (reason) => {
        console.log("[Socket.IO] Connection closed:", reason)
        this.setState("disconnected")
      })

      this.socket.on("connect_error", (error) => {
        console.error("[Socket.IO] Connection error:", error)
        const errorObj = new Error(error.message || "Socket.IO connection error")
        this.errorHandlers.forEach((handler) => handler(errorObj))
        this.setState("error")
      })

      // jnaudiostream events: route to AudioStreamer
      this.socket.on(
        "bufferHeader",
        async (packet: { mimeType: string; data: ArrayBuffer | Blob }) => {
          await this.ensureStreamer()
          // Ignore if no active start/recording session (prevents stale events post-stop)
          if (!(this.starting || this.isRecording())) return
          console.log("[Socket.IO] Received bufferHeader:", packet?.mimeType)
          this.streamer!.setBufferHeader(packet)
          // Begin playback only after header to avoid AbortError from new load during play
          if (this.shouldPlayOnHeader) {
            try {
              this.streamer!.playStream()
              this.shouldPlayOnHeader = false
            } catch (error) {
              console.log(
                "[Audio] playStream() failed after header, waiting for next user gesture:",
                error,
              )
              const retry = () => {
                try {
                  this.streamer!.playStream()
                  this.shouldPlayOnHeader = false
                } catch (e) {
                  console.log("[Audio] playStream() retry failed on gesture:", e)
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

      this.socket.on("stream", async (packet: Array<ArrayBuffer | Blob>) => {
        await this.ensureStreamer()
        // Ignore if no active start/recording session
        if (!(this.starting || this.isRecording())) return
        console.log("[Socket.IO] Received stream buffers:", packet?.length)
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
    if (this.socketUnavailable) {
      console.log("[SocketIOManager.disconnect] Socket is unavailable")
      return
    }
    if (this.socket) {
      this.socket.disconnect()
      this.socket.removeAllListeners()
      this.socket = null
    }

    this.setState("disconnected")
    // Ensure audio streamer is stopped/reset as well
    try {
      this.streamer?.stop()
    } catch (error) {
      console.log("[Audio] streamer.stop() failed during disconnect:", error)
    }
    this.streamer = null
    this.shouldPlayOnHeader = false
  }

  // jnaudiostream: start/stop microphone streaming
  async startStreaming(bufferDurationMs = 500, constraints?: MediaStreamConstraints) {
    if (this.socketUnavailable) {
      console.log("[SocketIOManager.startStreaming] Socket is unavailable")
      return
    }
    console.log("[Audio] startStreaming() called")
    if (this.starting || this.stopping) {
      console.log("[Audio] start ignored: transition in progress (starting/stopping)")
      return
    }
    if (this.isRecording()) {
      console.log("[Audio] already recording")
      return
    }
    if (!this.socket?.connected) {
      console.log("[Audio] not connected to socket")
      return
    }

    // Ensure a fresh streamer for this session; playback will begin after header
    console.log("[Audio] resetting streamer")
    // Ensure previous recorder (if any) is stopped before starting a new one
    try {
      this.recorder?.stopRecording()
    } catch (error) {
      console.log("[Audio] recorder.stopRecording() before restart failed:", error)
    }
    this.recorder = null

    this.starting = true
    await this.resetStreamer?.()
    console.log("[Audio] ensuring streamer")
    await this.ensureStreamer()
    // Mark to start playback when header arrives (safer than playing before header)
    this.shouldPlayOnHeader = true

    console.log("[Audio] initializing recorder")
    // Initialize recorder
    const mod: JNAudioModule = (await import("jnaudiostream")) as unknown as JNAudioModule
    this.recorder = new mod.AudioRecorder(constraints, bufferDurationMs)
    this.recorder.debug = false

    // Header callback (library names vary: support both)
    const handleHeader = (packet: { mimeType: string; data: Blob }) => {
      // Forward header to server
      this.socket?.emit("bufferHeader", packet)
    }

    const handleBuffer = (packet: Array<Blob>) => {
      // Forward audio chunks to server
      this.socket?.emit("stream", packet)
    }

    this.recorder.onReady = handleHeader
    this.recorder.onRecordingReady = handleHeader
    this.recorder.onBuffer = handleBuffer
    this.recorder.onBufferProcess = handleBuffer

    // Streamer already ensured and started above
    console.log("[Audio] starting recording")
    try {
      await Promise.resolve(this.recorder.startRecording())
      this.recordingSubscribers.forEach((cb) => cb(this.isRecording()))
    } catch (e) {
      this.recordingSubscribers.forEach((cb) => cb(this.isRecording()))
      const err = e instanceof Error ? e : new Error("Failed to start microphone")
      this.errorHandlers.forEach((handler) => handler(err))
      // Best effort stop if partially started
      try {
        this.recorder.stopRecording()
      } catch (error) {
        console.log("[Audio] recorder.stopRecording() failed after start error:", error)
      }
    } finally {
      this.starting = false
    }
  }

  stopStreaming() {
    if (this.socketUnavailable) {
      console.log("[SocketIOManager.stopStreaming] Socket is unavailable")
      return
    }
    if (this.stopping) {
      console.log("[Audio] stop ignored: already stopping")
      return
    }
    this.stopping = true
    if (this.recorder && this.isRecording()) {
      this.recorder.stopRecording()
    }
    this.recordingSubscribers.forEach((cb) => cb(this.isRecording()))
    // Stop and reset streamer so the next session doesn't interrupt current load/play
    try {
      this.streamer?.stop()
    } catch (error) {
      console.log("[Audio] streamer.stop() failed during stopStreaming:", error)
    }
    this.streamer = null
    this.recorder = null
    this.shouldPlayOnHeader = false
    this.stopping = false
  }

  isRecording(): boolean {
    const r = this.recorder
    if (!r) return false
    if (typeof r.recording === "boolean") return r.recording
    const mr = r.mediaRecorder
    return mr?.state === "recording"
  }

  private async ensureStreamer() {
    if (!this.streamer) {
      const mod: JNAudioModule = (await import("jnaudiostream")) as unknown as JNAudioModule
      this.streamer = new mod.AudioStreamer(1000)
      this.streamer.debug = false
    }
  }

  // Stop and discard the current streamer instance, if any
  private async resetStreamer() {
    if (this.streamer) {
      try {
        this.streamer.stop()
      } catch (error) {
        console.log("[Audio] streamer.stop() failed during resetStreamer():", error)
      }
      this.streamer = null
    }
  }

  subscribeState(callback: (state: ConnectionState) => void) {
    this.subscribers.add(callback)
    // Immediately call with current state
    callback(this.state)
    return () => this.subscribers.delete(callback)
  }

  subscribeMessages(callback: (data: ArrayBuffer) => void) {
    this.messageHandlers.add(callback)
    return () => this.messageHandlers.delete(callback)
  }

  subscribeRecording(callback: (recording: boolean) => void) {
    this.recordingSubscribers.add(callback)
    callback(this.isRecording())
    return () => {
      this.recordingSubscribers.delete(callback)
    }
  }

  subscribeErrors(callback: (error: Error) => void) {
    this.errorHandlers.add(callback)
    return () => this.errorHandlers.delete(callback)
  }

  // Increment hook usage counter
  incrementHookCount() {
    this.activeHooks++
  }

  // Decrement hook usage counter and disconnect if no hooks remain
  decrementHookCount() {
    this.activeHooks--
    if (this.activeHooks <= 0) {
      this.activeHooks = 0 // Prevent negative counts
      // Disconnect when no hooks are using the connection
      this.disconnect()
    }
  }

  getActiveHookCount(): number {
    return this.activeHooks
  }

  getState(): ConnectionState {
    return this.state
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false
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
    onVoiceDataRef.current = onVoiceData
    onErrorRef.current = onError
    onStateChangeRef.current = onStateChange
  }, [onVoiceData, onError, onStateChange])

  // Set token getter when available
  useEffect(() => {
    if (getToken) {
      socketManager.setTokenGetter(async () => {
        try {
          return await getToken()
        } catch (error) {
          console.error("[Socket.IO] Failed to get token:", error)
          return null
        }
      })
    }
  }, [getToken])

  // Subscribe to connection state changes
  useEffect(() => {
    const unsubscribe = socketManager.subscribeState((state) => {
      setConnectionState(state)
      onStateChangeRef.current?.(state)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Subscribe to incoming voice data
  useEffect(() => {
    if (!onVoiceDataRef.current) return

    const unsubscribe = socketManager.subscribeMessages((data) => {
      onVoiceDataRef.current?.(data)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Subscribe to errors
  useEffect(() => {
    if (!onErrorRef.current) return

    const unsubscribe = socketManager.subscribeErrors((error) => {
      onErrorRef.current?.(error)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Subscribe to recording state changes
  useEffect(() => {
    const unsubscribe = socketManager.subscribeRecording((r) => setRecording(r))
    return () => unsubscribe()
  }, [])

  // Track hook instance and manage connection lifecycle
  useEffect(() => {
    socketManager.incrementHookCount()

    if (autoConnect) {
      void socketManager.connect()
    }

    // Cleanup on unmount - decrement counter and disconnect if last hook
    return () => {
      socketManager.decrementHookCount()
    }
  }, [autoConnect])

  const startStreaming = useCallback(
    (bufferDurationMs?: number, constraints?: MediaStreamConstraints) => {
      return socketManager.startStreaming(bufferDurationMs, constraints)
    },
    [],
  )

  const stopStreaming = useCallback(() => {
    socketManager.stopStreaming()
  }, [])

  const connect = useCallback(() => {
    void socketManager.connect()
  }, [])

  const disconnect = useCallback(() => {
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
// Local minimal typings to avoid using `any` while dynamically importing the library
interface JNAudioRecorder {
  debug: boolean
  recording: boolean
  mediaRecorder?: MediaRecorder
  onReady?: (packet: { mimeType: string; data: Blob }) => void
  onRecordingReady?: (packet: { mimeType: string; data: Blob }) => void
  onBuffer?: (packet: Array<Blob>) => void
  onBufferProcess?: (packet: Array<Blob>) => void
  startRecording(): void | Promise<void>
  stopRecording(): void
}

interface JNAudioStreamer {
  debug: boolean
  playStream(): void
  setBufferHeader(packet: { mimeType: string; data: ArrayBuffer | Blob }): void
  receiveBuffer(packet: Array<ArrayBuffer | Blob>): void
  stop(): void
}

interface JNAudioModule {
  AudioRecorder: new (
    constraints?: MediaStreamConstraints,
    bufferDurationMs?: number,
  ) => JNAudioRecorder
  AudioStreamer: new (latencyMs?: number) => JNAudioStreamer
}
