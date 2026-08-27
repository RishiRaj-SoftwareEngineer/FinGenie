import { currentUser } from "@clerk/nextjs/server";
import { db } from "./prisma";

export const isAdmin = async () => {
  const user = await currentUser();
  if (!user) return false;

  try {
    const found = await db.user.findUnique({ where: { clerkUserId: user.id } });
    if (!found) return false;
    return found.role === "ADMIN";
  } catch (err) {
    console.error("isAdmin check failed", err);
    return false;
  }
};
