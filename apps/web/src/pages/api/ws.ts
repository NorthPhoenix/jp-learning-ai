import type { NextApiRequest, NextApiResponse } from "next"
import { getAuth } from "@clerk/nextjs/server"

import type { Server } from "http"
import { WebSocketServer, type WebSocket } from "ws"

type WithWSS = {
  wss?: WebSocketServer
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Use `getAuth()` to access `isAuthenticated` and the user's ID
  const { isAuthenticated, userId } = getAuth(req)

  // Protect the route by checking if the user is signed in
  if (!isAuthenticated) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  // Type assertion: socket.server exists in HTTP server context
  const socketWithServer = res.socket as { server?: Server } | null
  if (!socketWithServer?.server) {
    res.status(500).end("Socket server not available")
    return
  }

  const server = socketWithServer.server as WithWSS & Server

  // Initialize once (important for dev/HMR)
  if (!server.wss) {
    const wss = new WebSocketServer({ noServer: true })
    server.wss = wss

    server.on("upgrade", (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        wss.emit("connection", ws, request)
      })
    })

    wss.on("connection", (ws: WebSocket) => {
      ws.on("message", (message) => {
        // Echo the message back
        ws.send(message)
      })

      ws.send("Welcome to the WebSocket server! " + userId)
    })
  }

  res.status(200).end("WebSocket server ready")
}
