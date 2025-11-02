# Japanese Learning AI - Monorepo

A monorepo containing a Japanese language learning application with voice-enabled AI tutoring.

## Project Structure

```
jp-learning-ai/
├── apps/
│   └── web/                    # Next.js app with integrated Mastra AI (deployed to Vercel)
├── packages/
│   └── database/               # Shared Prisma database schema
├── pnpm-workspace.yaml         # pnpm workspace configuration
├── turbo.json                  # Turborepo configuration
└── package.json                # Root workspace package.json
```

## Tech Stack

### Web App (`apps/web`)

- **Next.js 16** with App Router
- **React 19**
- **tRPC** for type-safe API calls
- **Tailwind CSS** with Radix UI components
- **TypeScript**
- **Mastra** AI framework (integrated)
  - **OpenAI Realtime Voice API** for voice interactions
  - **GPT-5 Nano** for agent reasoning
  - Voice-enabled Japanese language tutoring agent

### Shared Packages

- **@repo/database**: Prisma client and schema shared across apps

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10.12.4+ (managed by `packageManager` field)

### Installation

1. Install dependencies:

```bash
pnpm install
```

2. Set up environment variables:

For the web app (`apps/web/.env`):

```env
DATABASE_URL=
OPENAI_API_KEY=
NODE_ENV=development
```

3. Generate Prisma client:

```bash
pnpm db:generate
```

4. Push database schema (development):

```bash
pnpm db:push
```

### Development

Run all apps in parallel:

```bash
pnpm dev
```

Run individual apps:

```bash
# Web app only
pnpm dev:web
```

### Building

Build all apps:

```bash
pnpm build
```

### Database Management

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations (production)
pnpm db:migrate

# Push schema changes (development)
pnpm db:push

# Open Prisma Studio
pnpm db:studio
```

### Other Commands

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint
pnpm lint:fix

# Formatting
pnpm format:check
pnpm format:write

# Clean all node_modules
pnpm clean
```

## Deployment

### Web App (Vercel)

The Next.js app in `apps/web/` with integrated Mastra AI can be deployed to Vercel:

1. Connect your GitHub repository to Vercel
2. Set the root directory to `apps/web`
3. Configure environment variables (DATABASE_URL, OPENAI_API_KEY, etc.)
4. Deploy

The Mastra AI functionality is integrated directly into the Next.js app using server actions and API routes.

## Monorepo Management

This monorepo uses **pnpm workspaces** and **Turborepo** for efficient task orchestration and caching:

- **Workspace dependencies**: Use `workspace:*` protocol for internal packages
- **Parallel execution**: Turborepo runs tasks across packages in parallel
- **Task caching**: Turborepo caches build outputs for faster subsequent runs
- **Filtering**: Use `--filter` to run commands in specific packages
- **Shared code**: The `@repo/database` package is shared between apps

### Turborepo Tasks

The project includes Turborepo tasks configured in `turbo.json`:

- `build`: Builds all apps with dependency management
- `dev`: Runs development servers (persistent, no cache)
- `lint` / `lint:fix`: Lints codebase
- `typecheck`: Type checks TypeScript code
- `db:generate`: Generates Prisma client
- `db:push` / `db:migrate`: Database management
- `db:studio`: Opens Prisma Studio

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Mastra Documentation](https://mastra.ai/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Prisma Documentation](https://www.prisma.io/docs)
