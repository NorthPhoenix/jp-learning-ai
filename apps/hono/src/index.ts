import "dotenv/config"
import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { clerkMiddleware, getAuth } from "@hono/clerk-auth"
import { Server } from "socket.io"
import { verifyToken } from "@clerk/backend"
// import { env } from "hono/adapter"

const app = new Hono()

app.use("*", clerkMiddleware(), async (c, next) => {
  // Allow Socket.IO handshake to pass through; we'll authenticate in the Socket.IO layer
  if (c.req.path.startsWith("/socket.io")) {
    await next()
    return
  }

  const auth = getAuth(c)

  if (!auth?.userId) {
    return c.json(
      {
        message: "You are not logged in.",
      },
      401,
    )
  }

  await next()
})

const port = Number(process.env.PORT) || 3001

const httpServer = serve({
  fetch: app.fetch,
  port: port,
})

// Create Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.CLERK_PUBLISHABLE_KEY
          ? "*" // Update with your production domain
          : "*"
        : "*",
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
})

// Authenticate Socket.IO connections using Clerk token from auth payload / headers / cookies
io.use(async (socket, next) => {
  try {
    const fromAuth = (socket.handshake.auth as { token?: string } | undefined)?.token
    const authzHeader = socket.handshake.headers.authorization
    const fromAuthz =
      typeof authzHeader === "string" ? authzHeader.replace("Bearer ", "") : undefined

    // Try __session cookie as a fallback
    let token = fromAuth || fromAuthz
    if (!token) {
      const cookieHeader = socket.handshake.headers.cookie || ""
      const match = cookieHeader.match(/(?:^|;\s*)__session=([^;]+)/)
      if (match) token = decodeURIComponent(match[1])
    }

    if (!token) {
      return next(new Error("Unauthorized"))
    }

    const verified = await verifyToken(token, {
      jwtKey: process.env.CLERK_JWT_KEY,
      authorizedParties:
        process.env.NODE_ENV === "development"
          ? ["http://localhost:3001"]
          : [process.env.FRONTEND_URL].filter((i) => i != null),
    })

    socket.data.userId = verified.sub
    return next()
  } catch (err) {
    console.error(`[Socket.IO] Error authenticating socket:`, err)
    return next(new Error("Unauthorized"))
  }
})

// Handle Socket.IO connections
io.on("connection", (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id} (User: ${socket.data.userId})`)

  // Handle ping/pong for keepalive
  socket.on("ping", () => {
    socket.emit("pong")
  })

  // jnaudiostream: receive header and buffers
  socket.on("bufferHeader", (packet: { mimeType: string; data: Blob; startTime: number }) => {
    // Optionally store per-socket header
    ;(socket.data as { audioHeader?: unknown }).audioHeader = packet
    // Echo back to sender and broadcast to others if desired
    console.log(`[Socket.IO] Received buffer header:`)
    console.log(`[Socket.IO] mimeType: ${packet.mimeType}`)
    console.log(`[Socket.IO] data size: ${packet.data.size} bytes`)
    console.log(`[Socket.IO] startTime: ${packet.startTime}`)
    socket.emit("bufferHeader", packet)
  })

  socket.on("stream", (packet: [Blob, number]) => {
    // Echo back to sender and broadcast to others
    console.log(`[Socket.IO] Received blob: ${typeof packet[0]}`)
    console.log(`[Socket.IO] packet[1]: ${packet[1]}`)
    socket.emit("stream", packet)
  })

  socket.on("disconnect", (reason) => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id} (Reason: ${reason})`)
  })

  socket.on("error", (error) => {
    console.error(`[Socket.IO] Socket error for ${socket.id}:`, error)
  })
})

console.log(`Server is running on http://localhost:${port}`)
console.log(`Socket.IO server is ready for connections`)
