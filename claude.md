# Japanese Learning AI - Repository Documentation

> **Last Updated**: 2026-01-11
> **Purpose**: Quick reference guide for Claude AI assistant to understand this codebase

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Directory Structure](#directory-structure)
5. [Key Components](#key-components)
6. [Data Flow](#data-flow)
7. [Development Guide](#development-guide)
8. [Important Files](#important-files)
9. [Common Tasks](#common-tasks)

---

## Project Overview

**Japanese Learning AI** is a voice-first language learning application that enables users to practice Japanese conversation with an AI tutor powered by OpenAI's Realtime Voice API.

**Key Features**:
- Real-time voice conversation with AI tutor
- Bilingual responses (Japanese + English translations)
- User authentication via Clerk
- Progress tracking and learning analytics (planned)
- WebSocket-based audio streaming

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Browser                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │    Next.js Frontend (apps/web)                      │   │
│  │    - React 19 Components                            │   │
│  │    - tRPC Client                                    │   │
│  │    - Socket.IO Client (useVoice hook)              │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────┬─────────────────────────────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
    HTTP/tRPC              WebSocket
         │                     │
         ▼                     ▼
┌────────────────┐    ┌────────────────────┐
│  Next.js API   │    │  Hono WebSocket    │
│   (tRPC)       │    │   Server           │
│                │    │  (apps/hono)       │
└────────────────┘    └─────────┬──────────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │  Mastra AI Agent     │
                    │  (packages/mastra)   │
                    │  - OpenAI Realtime   │
                    │  - GPT-5 Nano        │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   PostgreSQL DB      │
                    │  (packages/database) │
                    └──────────────────────┘
```

### Monorepo Structure

This is a **Turborepo monorepo** using **pnpm workspaces**:

```
jp-learning-ai/
├── apps/
│   ├── web/          # Next.js frontend (port 3000)
│   └── hono/         # Hono WebSocket server (port 3001)
├── packages/
│   ├── database/     # Shared Prisma schema & client
│   └── mastra/       # Mastra AI agent configuration
```

---

## Tech Stack

### Frontend (apps/web)
- **Framework**: Next.js 16 (App Router, React Server Components)
- **React**: v19
- **TypeScript**: 5.9.3
- **Styling**: Tailwind CSS 4.1.16
- **UI Components**: Radix UI (dialog, dropdown, select, etc.)
- **API Layer**: tRPC 11.7.0 (type-safe API)
- **Auth**: Clerk
- **Real-time**: Socket.IO Client 4.8
- **Audio**: jnaudiostream, custom AudioRecorder
- **Analytics**: Vercel Analytics
- **Notifications**: Sonner (toasts)

### Backend (apps/hono)
- **Framework**: Hono 4.10 (fast web framework)
- **Runtime**: Node.js (@hono/node-server)
- **WebSocket**: Socket.IO 4.8
- **Auth**: Clerk Backend (JWT validation)

### AI/Voice (packages/mastra)
- **AI Framework**: Mastra Core 0.23.1
- **Voice**: @mastra/voice-openai-realtime
- **Model**: GPT-5 Nano (reasoning agent)
- **Memory**: Mastra Memory (PostgreSQL-backed)
- **Logging**: Pino via Mastra Loggers

### Database (packages/database)
- **ORM**: Prisma 6.18
- **Database**: PostgreSQL
- **Extension**: Prisma Accelerate (performance)

### Tooling
- **Package Manager**: pnpm 10.12.4 (enforced)
- **Build Tool**: Turborepo
- **Linting**: ESLint + Prettier
- **TypeScript**: Strict mode enabled

---

## Directory Structure

### apps/web (Next.js Frontend)

```
apps/web/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # Home page
│   │   ├── conversation/      # Main conversation page
│   │   ├── sign-in/           # Auth pages
│   │   └── layout.tsx         # Root layout
│   ├── components/            # React components
│   │   ├── conversation-page.tsx         # Main conversation UI
│   │   ├── microphone-orb.tsx           # Voice input button
│   │   ├── conversation-messages.tsx    # Message list
│   │   ├── learning-panel.tsx           # Side panel
│   │   ├── ai-tutor-status.tsx          # Status indicator
│   │   └── ui/               # Radix UI components
│   ├── hooks/
│   │   └── useVoice.tsx      # WebSocket & audio hook
│   ├── lib/
│   │   ├── AudioRecorder.ts  # Audio recording logic
│   │   └── utils.ts          # Utilities
│   ├── server/
│   │   └── api/              # tRPC server
│   │       ├── trpc.ts       # tRPC setup
│   │       ├── root.ts       # Root router
│   │       └── routers/      # API routers
│   ├── trpc/                 # tRPC client
│   │   ├── react.tsx         # React Query provider
│   │   └── server.ts         # Server-side caller
│   └── styles/
│       └── globals.css       # Global styles
├── public/                   # Static assets
├── next.config.ts           # Next.js config
├── tailwind.config.ts       # Tailwind config
└── tsconfig.json            # TypeScript config
```

### apps/hono (WebSocket Server)

```
apps/hono/
├── src/
│   └── index.ts             # Main server file
│       - Hono app setup
│       - Socket.IO server
│       - Clerk authentication
│       - Audio streaming handlers
├── package.json
└── tsconfig.json
```

### packages/database

```
packages/database/
├── prisma/
│   └── schema.prisma        # Database schema
├── src/
│   └── index.ts             # Prisma client export
└── package.json
```

### packages/mastra

```
packages/mastra/
├── src/
│   ├── agents/
│   │   └── japanese-tutor-agent.ts  # AI agent config
│   └── index.ts             # Mastra instance
└── package.json
```

---

## Key Components

### 1. Conversation Page (`apps/web/src/components/conversation-page.tsx`)
- Main UI container for the conversation interface
- Manages conversation state (messages, AI status)
- Integrates `useVoice` hook for audio communication
- Handles microphone button interactions

**Location**: `/home/user/jp-learning-ai/apps/web/src/components/conversation-page.tsx`

### 2. useVoice Hook (`apps/web/src/hooks/useVoice.tsx`)
**Critical component** - manages all real-time audio communication

**Key Classes/Functions**:
- `SocketIOManager` (singleton): Manages WebSocket connection lifecycle
- `AudioRecorder`: Handles microphone input and streaming
- `useVoice()`: React hook exposing audio controls

**States**:
- Connection: `disconnected` | `connecting` | `connected`
- Recording: `idle` | `pending` | `listening`

**Location**: `/home/user/jp-learning-ai/apps/web/src/hooks/useVoice.tsx`

### 3. Microphone Orb (`apps/web/src/components/microphone-orb.tsx`)
- Visual interface for voice input
- Three states with animations:
  - `idle`: Breathing animation
  - `listening`: Pulsing glow
  - `pending`: Spinning loader
- Click to start/stop recording

**Location**: `/home/user/jp-learning-ai/apps/web/src/components/microphone-orb.tsx`

### 4. AudioRecorder (`apps/web/src/lib/AudioRecorder.ts`)
- Custom audio recording implementation
- Uses MediaRecorder API
- Codec detection (WebM/Opus preferred)
- Chunks audio with configurable latency
- Sends `bufferHeader` + `stream` events via Socket.IO

**Location**: `/home/user/jp-learning-ai/apps/web/src/lib/AudioRecorder.ts`

### 5. WebSocket Server (`apps/hono/src/index.ts`)
- Hono framework with Node.js server
- Socket.IO attached for WebSocket communication
- Clerk JWT authentication on connection
- Event handlers:
  - `bufferHeader`: Audio format initialization
  - `stream`: Audio chunk streaming
- Currently echoes audio back (ready for AI integration)

**Location**: `/home/user/jp-learning-ai/apps/hono/src/index.ts`

### 6. Japanese Tutor Agent (`packages/mastra/src/agents/japanese-tutor-agent.ts`)
- Mastra AI agent configuration
- Model: GPT-5 Nano
- Voice: OpenAI Realtime "shimmer"
- Instructions: Bilingual tutor (Japanese + English)
- Memory: PostgreSQL-backed for conversation history

**Location**: `/home/user/jp-learning-ai/packages/mastra/src/agents/japanese-tutor-agent.ts`

### 7. tRPC Setup
- **Server**: `apps/web/src/server/api/`
  - `trpc.ts`: Core tRPC configuration
  - `root.ts`: Aggregates all routers
  - `routers/`: Individual API routers
- **Client**: `apps/web/src/trpc/`
  - `react.tsx`: React Query provider
  - `server.ts`: Server-side tRPC caller

---

## Data Flow

### Voice Conversation Flow

```
1. User clicks microphone orb
   ↓
2. Frontend: useVoice.startRecording()
   ↓
3. AudioRecorder: Request microphone permission
   ↓
4. AudioRecorder: Start MediaRecorder
   ↓
5. Socket.IO: Send "bufferHeader" (audio format metadata)
   ↓
6. Socket.IO: Stream audio chunks via "stream" event
   ↓
7. Hono Server: Receive audio chunks
   ↓
8. [Future] Mastra Agent: Process audio with OpenAI Realtime
   ↓
9. [Future] Mastra Agent: Generate Japanese response
   ↓
10. Socket.IO: Send audio response back to client
    ↓
11. Frontend: AudioStreamer (jnaudiostream) plays response
    ↓
12. User hears AI tutor's voice
```

### Authentication Flow

```
1. User visits app
   ↓
2. Clerk: Check authentication status
   ↓
3. If not authenticated: Show sign-in modal
   ↓
4. User signs in via Clerk
   ↓
5. Clerk: Issue JWT token
   ↓
6. Frontend: Store token in Clerk client
   ↓
7. WebSocket connection: Send JWT in auth handshake
   ↓
8. Hono Server: Validate JWT with Clerk backend
   ↓
9. Connection established (or rejected)
```

---

## Development Guide

### Prerequisites

- Node.js 18+ (20+ recommended)
- pnpm 10.12.4
- PostgreSQL database
- OpenAI API key (for Mastra agent)
- Clerk account (for authentication)

### Environment Setup

**apps/web/.env**:
```env
DATABASE_URL="postgresql://..."
OPENAI_API_KEY="sk-..."
NODE_ENV="development"
CLERK_SECRET_KEY="sk_..."
CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
NEXT_PUBLIC_WEBSOCKET_SERVER_URL="http://localhost:3001"
```

**apps/hono/.env**:
```env
PORT=3001
CLERK_JWT_KEY="..."
FRONTEND_URL="http://localhost:3000"
NODE_ENV="development"
```

### Installation

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Push database schema
pnpm db:push
```

### Running Development Servers

```bash
# Run all apps concurrently
pnpm dev

# Or run individually
pnpm dev:web     # Next.js on port 3000
pnpm dev:hono    # Hono on port 3001
```

### Building for Production

```bash
pnpm build       # Builds all apps
pnpm typecheck   # Check TypeScript
pnpm lint        # Check linting
```

---

## Important Files

### Configuration Files

| File | Purpose | Location |
|------|---------|----------|
| `pnpm-workspace.yaml` | Workspace configuration | Root |
| `turbo.json` | Turborepo build config | Root |
| `next.config.ts` | Next.js configuration | `apps/web/` |
| `tailwind.config.ts` | Tailwind CSS config | `apps/web/` |
| `.prettierrc.json` | Code formatting | Root |
| `.prettierignore` | Prettier ignore rules | Root |

### Schema Files

| File | Purpose | Location |
|------|---------|----------|
| `schema.prisma` | Database schema | `packages/database/prisma/` |

### Entry Points

| File | Purpose | Location |
|------|---------|----------|
| `apps/web/src/app/page.tsx` | Home page | `apps/web/` |
| `apps/web/src/app/conversation/page.tsx` | Conversation page | `apps/web/` |
| `apps/hono/src/index.ts` | WebSocket server | `apps/hono/` |

---

## Common Tasks

### Adding a New UI Component

```bash
# Create component file
touch apps/web/src/components/my-component.tsx

# If it's a Radix UI wrapper, place in:
# apps/web/src/components/ui/my-component.tsx
```

**Pattern**:
```typescript
"use client" // If component uses hooks or interactivity

export function MyComponent() {
  return <div>Component content</div>
}
```

### Adding a tRPC Router

1. Create router file: `apps/web/src/server/api/routers/my-router.ts`
2. Define procedures with Zod validation
3. Import and add to `root.ts`:

```typescript
import { myRouter } from "./routers/my-router"

export const appRouter = createTRPCRouter({
  post: postRouter,
  my: myRouter, // Add here
})
```

4. Use in component:
```typescript
const { data } = api.my.getPosts.useQuery()
```

### Updating Database Schema

```bash
# Edit schema
vim packages/database/prisma/schema.prisma

# Generate Prisma client
pnpm db:generate

# Push to database
pnpm db:push

# Or create migration (production)
pnpm db:migrate
```

### Adding Environment Variables

1. Add to appropriate `.env` file
2. If `NEXT_PUBLIC_*`, add to `apps/web/.env`
3. For server-only vars, use without prefix
4. Update `.env.example` files
5. Restart dev servers

### Debugging WebSocket Connection

**Frontend logs** (in browser console):
```
Look for: [🔌 Socket] [📢 Recorder] [🔊 Player]
```

**Server logs** (in terminal):
```
Look for: SocketIO client connected/disconnected
```

**Check connection**:
- Frontend: `useVoice().connectionStatus`
- Server: Socket.IO dashboard or logs

### Working with Audio

**AudioRecorder** (`apps/web/src/lib/AudioRecorder.ts`):
- Latency: Currently 100ms chunks
- Codec: Prefers WebM/Opus
- Buffer: Sends header before stream

**AudioStreamer** (jnaudiostream):
- Handles playback of streamed audio
- Auto-manages audio context
- Used in `useVoice` hook

### Styling Guidelines

- Use Tailwind CSS utility classes
- Custom colors in `tailwind.config.ts`:
  - Sakura theme: `sakura-pink`, `sakura-light`, etc.
  - Dark mode: `dark:` prefix
- Component library: Radix UI (in `components/ui/`)
- Icons: Lucide React
- Font: Noto Sans JP for Japanese text

---

## Database Schema

### Current Schema

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Note**: Schema is minimal. Planned additions:
- Conversation history
- Learning progress
- Vocabulary/grammar tracking
- User preferences

---

## Known Issues & Limitations

1. **WebSocket Server**: Currently echoes audio back, not yet integrated with Mastra AI
2. **Learning Panel**: UI exists but data is mocked
3. **Database**: Minimal schema, needs expansion for full features
4. **Error Handling**: Some error cases need better UX
5. **Mobile**: Not fully optimized for mobile browsers
6. **Audio Codecs**: Codec support varies by browser

---

## Future Development

### Planned Features
- [ ] Full Mastra AI integration for voice responses
- [ ] Conversation history persistence
- [ ] Learning progress tracking
- [ ] Vocabulary flashcards
- [ ] Grammar explanations
- [ ] Cultural notes
- [ ] Lesson plans
- [ ] Achievement system
- [ ] Mobile app (React Native?)

### Technical Improvements
- [ ] Better error handling and recovery
- [ ] Audio codec fallbacks
- [ ] Offline mode
- [ ] Performance optimization
- [ ] Comprehensive test coverage
- [ ] Monitoring and observability
- [ ] Rate limiting
- [ ] Conversation context management

---

## Useful Commands Reference

```bash
# Development
pnpm dev                    # Run all apps
pnpm dev:web               # Run Next.js only
pnpm dev:hono              # Run Hono server only

# Building
pnpm build                 # Build all apps
pnpm typecheck             # Type check all apps
pnpm lint                  # Lint all apps
pnpm lint:fix              # Auto-fix linting issues

# Database
pnpm db:generate           # Generate Prisma client
pnpm db:push               # Push schema to DB
pnpm db:migrate            # Create migration
pnpm db:studio             # Open Prisma Studio

# Formatting
pnpm format:check          # Check code formatting
pnpm format:write          # Auto-format code

# Cleaning
pnpm clean                 # Remove node_modules
pnpm clean:all             # Remove node_modules and build artifacts
```

---

## Architecture Decisions

### Why Monorepo?
- Shared code (database schema, types)
- Consistent tooling and dependencies
- Atomic commits across frontend/backend
- Easier refactoring

### Why Hono for WebSocket Server?
- Lightweight and fast
- TypeScript-first
- Easy to deploy
- Simple to integrate Socket.IO

### Why Mastra?
- Simplified AI agent development
- Built-in memory management
- OpenAI Realtime Voice integration
- PostgreSQL-backed persistence

### Why tRPC?
- End-to-end type safety
- No code generation needed
- Excellent DX with React Query
- Auto-completion and validation

---

## Getting Help

1. **Documentation**: See main `README.md` files
2. **Logs**: Check browser console and terminal output
3. **Database**: Use `pnpm db:studio` to inspect data
4. **Types**: Use TypeScript's "Go to Definition" extensively
5. **Community**: Mastra, Next.js, tRPC Discord servers

---

## Notes for Claude

- **Always read files before editing**: Use Read tool first
- **Check current branch**: Development on `claude/learn-repo-docs-WycNl`
- **Environment variables**: Required for both apps to work
- **WebSocket server must be running**: Frontend needs it for voice
- **Prisma client**: Regenerate after schema changes
- **Type safety**: tRPC types auto-update after router changes
- **Audio debugging**: Check browser console for detailed logs
- **Authentication**: Clerk must be configured for app to work

---

**End of Documentation**
