# Japanese Learning AI - Web Frontend

Next.js frontend for the Japanese language learning application.

## Development

```bash
# From root
pnpm dev:web

# Or from this directory
pnpm dev
```

## Environment Variables

Create a `.env` file in this directory with:

```env
DATABASE_URL=postgresql://...
# Add other required env vars
```

## Building

```bash
pnpm build
```

## Deployment

This app is designed to be deployed to Vercel. Configure the Vercel project to use `apps/web` as the root directory.
