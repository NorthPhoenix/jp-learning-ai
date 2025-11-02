import { PrismaClient } from "../generated/prisma"
import { withAccelerate } from "@prisma/extension-accelerate"

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
}).$extends(withAccelerate())

const globalForPrisma = globalThis as unknown as {
  prisma: typeof prisma
}

export const db = globalForPrisma.prisma ?? prisma

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
