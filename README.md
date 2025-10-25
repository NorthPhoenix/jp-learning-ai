# Japanese Learning AI - Monorepo

A monorepo containing a Japanese language learning application with voice-enabled AI tutoring.

## Project Structure

```
jp-learning-ai/
├── apps/
│   ├── web/                    # Next.js frontend (deployed to Vercel)
│   └── mastra-backend/         # Mastra AI backend (deployed to Mastra Cloud)
├── packages/
│   └── database/               # Shared Prisma database schema
├── pnpm-workspace.yaml         # pnpm workspace configuration
└── package.json                # Root workspace package.json
```

## Tech Stack

### Frontend (`apps/web`)

- **Next.js 16** with App Router
- **React 19**
- **tRPC** for type-safe API calls
- **Tailwind CSS** with Radix UI components
- **TypeScript**

### Backend (`apps/mastra-backend`)

- **Mastra** AI framework
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
# ... other Next.js env vars
```

For the Mastra backend (`apps/mastra-backend/.env`):

```env
OPENAI_API_KEY=
DATABASE_URL=  # if needed
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
# Web frontend only
pnpm dev:web

# Mastra backend only
pnpm dev:mastra
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

The Next.js frontend in `apps/web/` can be deployed to Vercel:

1. Connect your GitHub repository to Vercel
2. Set the root directory to `apps/web`
3. Configure environment variables
4. Deploy

### Mastra Backend (Mastra Cloud)

The Mastra backend in `apps/mastra-backend/` can be deployed to Mastra Cloud:

1. Follow Mastra Cloud deployment documentation
2. Configure environment variables (OPENAI_API_KEY, etc.)
3. Deploy using Mastra CLI

## Monorepo Management

This is a basic monorepo using pnpm workspaces. Key features:

- **Workspace dependencies**: Use `workspace:*` protocol for internal packages
- **Parallel execution**: Commands run across all packages with `-r --parallel`
- **Filtering**: Use `--filter` to run commands in specific packages
- **Shared code**: The `@repo/database` package is shared between apps

### Next Steps (Optional)

To add Turborepo for improved caching and task orchestration:

```bash
pnpm add turbo -D -w
```

Then create a `turbo.json` configuration file for pipeline management.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Mastra Documentation](https://mastra.ai/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Prisma Documentation](https://www.prisma.io/docs)
