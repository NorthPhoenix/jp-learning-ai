# Cleanup Guide

These files/directories can be safely deleted from the root as they've been moved to their respective app directories:

## Files to Remove

```bash
# Run from project root

# Old source directory (now in apps/web/ and apps/mastra-backend/)
rm -rf src/

# Old public directory (now in apps/web/public/)
rm -rf public/

# Old Prisma directory (now in packages/database/prisma/)
rm -rf prisma/

# Old Next.js config files (now in apps/web/)
rm next.config.ts
rm next-env.d.ts
rm components.json
rm postcss.config.js
rm eslint.config.js

# Old lock file (will be regenerated)
# Only if you have issues, otherwise keep it
# rm pnpm-lock.yaml && pnpm install
```

## ⚠️ Important: DO NOT DELETE

- `.git/` - Your git repository
- `.gitignore` - Root gitignore (updated for monorepo)
- `node_modules/` - Will be cleaned and regenerated
- `pnpm-workspace.yaml` - Workspace configuration
- `package.json` - Root workspace package.json
- `prettier.config.js` - Root prettier config
- `tsconfig.json` - Root TypeScript config
- `README.md` - Main documentation
- `MIGRATION-GUIDE.md` - This migration guide

## Automated Cleanup Script

You can run this command to clean up all old files at once:

```bash
cd /Users/nistomin/projects/jp-learning-ai

# Remove old directories
rm -rf src/ public/ prisma/

# Remove old config files
rm -f next.config.ts next-env.d.ts components.json postcss.config.js eslint.config.js

echo "✅ Cleanup complete!"
```

## After Cleanup

1. Verify everything still works:

   ```bash
   pnpm dev
   ```

2. If issues arise, check that:
   - All dependencies are installed: `pnpm install`
   - Prisma client is generated: `pnpm db:generate`
   - Environment variables are set in each app

## Git Commit

After cleanup, commit the changes:

```bash
git add .
git commit -m "refactor: convert to monorepo structure"
```
