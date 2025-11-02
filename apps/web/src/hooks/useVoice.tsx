"use client"

import { useEffect, useRef, useCallback, useState } from "react"

type ConnectionState = "disconnected" | "connecting" | "connected" | "error"

interface UseVoiceOptions {
  onVoiceData?: (data: ArrayBuffer) => void
  onError?: (error: Error) => void
  onStateChange?: (state: ConnectionState) => void
  autoConnect?: boolean
}

// Singleton WebSocket connection manager
class WebSocketManager {
  private ws: WebSocket | null = null
  private state: ConnectionState = "disconnected"
  private subscribers = new Set<(state: ConnectionState) => void>()
  private messageHandlers = new Set<(data: ArrayBuffer) => void>()
  private errorHandlers = new Set<(error: Error) => void>()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private reconnectTimer: NodeJS.Timeout | null = null
  private pingInterval: NodeJS.Timeout | null = null
  private url: string
  private activeHooks = 0 // Track number of active hook instances

  constructor() {
    // Determine WebSocket URL based on current location
    if (typeof window !== "undefined") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
      const host = window.location.host
      this.url = `${protocol}//${host}/api/ws`
    } else {
      this.url = "ws://localhost:3000/api/ws"
    }
  }

  private setState(newState: ConnectionState) {
    if (this.state !== newState) {
      this.state = newState
      this.subscribers.forEach((callback) => callback(newState))
    }
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private clearPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private scheduleReconnect() {
    this.clearReconnectTimer()

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setState("error")
      return
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.connect()
    }, this.reconnectDelay * this.reconnectAttempts)
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    if (this.ws?.readyState === WebSocket.CONNECTING) {
      return
    }

    this.setState("connecting")

    try {
      console.log("[WebSocket] Attempting to connect to:", this.url)
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        console.log("[WebSocket] Connection opened successfully")
        this.reconnectAttempts = 0
        this.setState("connected")
        this.clearReconnectTimer()

        // Set up ping/pong keepalive
        this.clearPingInterval()
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: "ping" }))
          }
        }, 30000)
      }

      this.ws.onmessage = (event) => {
        // Handle binary data (voice data)
        if (event.data instanceof ArrayBuffer) {
          this.messageHandlers.forEach((handler) => handler(event.data as ArrayBuffer))
        } else if (event.data instanceof Blob) {
          void event.data.arrayBuffer().then((buffer) => {
            this.messageHandlers.forEach((handler) => handler(buffer))
          })
        } else {
          // Handle text messages (like ping/pong or JSON)
          try {
            const message = JSON.parse(event.data as string) as { type?: string }
            if (message.type === "pong") {
              // Pong received, connection is alive
              return
            }
          } catch {
            // Not JSON, treat as binary if possible
            if (typeof event.data === "string") {
              // Echo or other text messages
              console.log("WebSocket text message:", event.data)
            }
          }
        }
      }

      this.ws.onerror = (error) => {
        console.error("[WebSocket] Error occurred:", error)
        console.error("[WebSocket] Connection state:", this.ws?.readyState)
        const errorObj = new Error("WebSocket error occurred")
        this.errorHandlers.forEach((handler) => handler(errorObj))
        this.setState("error")
      }

      this.ws.onclose = (event) => {
        console.log("[WebSocket] Connection closed:", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        })
        this.clearPingInterval()
        this.setState("disconnected")

        // Attempt to reconnect if not a clean close
        if (event.code !== 1000 && event.code !== 1001) {
          this.scheduleReconnect()
        }
      }
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error("Failed to create WebSocket connection")
      this.errorHandlers.forEach((handler) => handler(errorObj))
      this.setState("error")
      this.scheduleReconnect()
    }
  }

  disconnect() {
    this.clearReconnectTimer()
    this.clearPingInterval()

    if (this.ws) {
      this.ws.close(1000, "Client disconnect")
      this.ws = null
    }

    this.setState("disconnected")
  }

  send(data: ArrayBuffer | Blob | string): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return false
    }

    try {
      this.ws.send(data)
      return true
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error("Failed to send data")
      this.errorHandlers.forEach((handler) => handler(errorObj))
      return false
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
    return this.ws?.readyState === WebSocket.OPEN
  }
}

// Singleton instance
const wsManager = new WebSocketManager()

const useVoice = (options: UseVoiceOptions = {}) => {
  const { onVoiceData, onError, onStateChange, autoConnect = true } = options

  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected")
  const onVoiceDataRef = useRef(onVoiceData)
  const onErrorRef = useRef(onError)
  const onStateChangeRef = useRef(onStateChange)

  // Keep refs updated
  useEffect(() => {
    onVoiceDataRef.current = onVoiceData
    onErrorRef.current = onError
    onStateChangeRef.current = onStateChange
  }, [onVoiceData, onError, onStateChange])

  // Subscribe to connection state changes
  useEffect(() => {
    const unsubscribe = wsManager.subscribeState((state) => {
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

    const unsubscribe = wsManager.subscribeMessages((data) => {
      onVoiceDataRef.current?.(data)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Subscribe to errors
  useEffect(() => {
    if (!onErrorRef.current) return

    const unsubscribe = wsManager.subscribeErrors((error) => {
      onErrorRef.current?.(error)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Track hook instance and manage connection lifecycle
  useEffect(() => {
    wsManager.incrementHookCount()

    if (autoConnect) {
      wsManager.connect()
    }

    // Cleanup on unmount - decrement counter and disconnect if last hook
    return () => {
      wsManager.decrementHookCount()
    }
  }, [autoConnect])

  const sendVoiceData = useCallback((data: ArrayBuffer | Blob) => {
    return wsManager.send(data)
  }, [])

  const connect = useCallback(() => {
    wsManager.connect()
  }, [])

  const disconnect = useCallback(() => {
    wsManager.disconnect()
  }, [])

  return {
    connectionState,
    isConnected: connectionState === "connected",
    sendVoiceData,
    connect,
    disconnect,
  }
}

export default useVoice
