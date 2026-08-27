import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function PostLoginPage() {
  const { userId } = await auth();
  if (!userId) return redirect("/sign-in");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { role: true },
  });

  if (user?.role === "ADMIN") return redirect("/admin");
  return redirect("/dashboard");
}

