# Migration Guide: Single App → Monorepo

This document explains the changes made to convert this project into a monorepo structure.

## What Changed

### Before (Single App)

```
jp-learning-ai/
├── src/
│   ├── app/              # Next.js app
│   ├── components/       # React components
│   ├── server/           # tRPC server
│   ├── mastra/           # Mastra agents
│   └── ...
├── prisma/               # Database schema
├── public/
└── package.json
```

### After (Monorepo)

```
jp-learning-ai/
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── src/
│   │   ├── public/
│   │   └── package.json
│   └── mastra-backend/         # Mastra AI backend
│       ├── src/
│       └── package.json
├── packages/
│   └── database/               # Shared Prisma database
│       ├── prisma/
│       ├── src/
│       └── package.json
├── pnpm-workspace.yaml
└── package.json                # Root workspace config
```

## Key Changes

### 1. **Workspace Structure**

- Created `apps/` directory for deployable applications
- Created `packages/` directory for shared libraries
- Added `pnpm-workspace.yaml` for workspace configuration

### 2. **Next.js App → `apps/web/`**

- Moved all Next.js code to `apps/web/`
- Updated imports to use `@repo/database` for Prisma
- Removed Mastra code (now in separate backend)
- Created dedicated `package.json` for web dependencies

### 3. **Mastra Backend → `apps/mastra-backend/`**

- Extracted Mastra agents and configuration
- Created standalone backend application
- Designed for Mastra Cloud deployment
- Minimal dependencies (only Mastra-related packages)

### 4. **Shared Database → `packages/database/`**

- Moved Prisma schema to shared package
- Both apps can import from `@repo/database`
- Centralized database client configuration

### 5. **Root Package.json**

- Now manages workspace-level scripts
- Removed app-specific dependencies
- Added workspace commands (dev:web, dev:mastra, etc.)

## Environment Variables

### Before

Single `.env` file at root

### After

Each app has its own `.env` file:

**`apps/web/.env`**

```env
DATABASE_URL=postgresql://...
# Next.js specific vars
```

**`apps/mastra-backend/.env`**

```env
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...  # if needed
```

## Running the Apps

### Before

```bash
npm run dev  # Ran everything together
```

### After

```bash
# Run all apps in parallel
pnpm dev

# Or run individually
pnpm dev:web
pnpm dev:mastra
```

## Building & Deployment

### Web App (Vercel)

1. **Root Directory**: Set to `apps/web` in Vercel settings
2. **Build Command**: `pnpm build`
3. **Install Command**: `pnpm install`
4. **Environment Variables**: Configure in Vercel dashboard

### Mastra Backend (Mastra Cloud)

1. Follow Mastra Cloud deployment guide
2. Point to `apps/mastra-backend` directory
3. Configure OPENAI_API_KEY and other env vars

## Database Management

### Before

```bash
npx prisma generate
npx prisma migrate dev
```

### After

```bash
pnpm db:generate   # Generate Prisma client
pnpm db:migrate    # Run migrations
pnpm db:push       # Push schema changes
pnpm db:studio     # Open Prisma Studio
```

## Dependencies

### Installing Packages

**For web app:**

```bash
pnpm --filter web add <package-name>
```

**For mastra backend:**

```bash
pnpm --filter mastra-backend add <package-name>
```

**For shared database:**

```bash
pnpm --filter @repo/database add <package-name>
```

**For root (dev tools):**

```bash
pnpm add -D -w <package-name>
```

## Next Steps

### Optional: Add Turborepo

Once the basic monorepo is working, you can add Turborepo for:

- Better build caching
- Parallel task execution
- Remote caching for CI/CD

```bash
pnpm add turbo -D -w
```

Then create `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {}
  }
}
```

## Troubleshooting

### Issue: "Cannot find module '@repo/database'"

**Solution**: Run `pnpm install` and `pnpm db:generate`

### Issue: Next.js can't resolve imports

**Solution**: Check `tsconfig.json` paths configuration in `apps/web/`

### Issue: Prisma client not found

**Solution**: Run `pnpm db:generate` to generate the client

### Issue: Environment variables not loading

**Solution**: Ensure each app has its own `.env` file in the correct location

## Benefits of This Structure

✅ **Separation of Concerns**: Frontend and backend are independent  
✅ **Different Deploy Targets**: Vercel for web, Mastra Cloud for backend  
✅ **Shared Code**: Database schema and types shared between apps  
✅ **Independent Scaling**: Each app can scale independently  
✅ **Better Developer Experience**: Clear boundaries and focused codebases  
✅ **Future-Ready**: Easy to add more apps or packages as needed
