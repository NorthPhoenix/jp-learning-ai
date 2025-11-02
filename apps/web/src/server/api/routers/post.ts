import { db } from "@repo/db"

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc"

export const postRouter = createTRPCRouter({
  hello: publicProcedure.query(async () => {
    const user = await db.user.findFirst()
    if (!user) {
      throw new Error("User not found")
    }
    return {
      greeting: `Hello ${user.email}`,
    }
  }),
})
