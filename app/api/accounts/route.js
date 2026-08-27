import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

function serializeDecimal(obj) {
  const serialized = { ...obj };
  if (obj.balance) serialized.balance = obj.balance.toNumber();
  if (obj.amount) serialized.amount = obj.amount.toNumber();
  return serialized;
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await db.user.findUnique({ where: { clerkUserId: userId } });
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const accounts = await db.account.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const serialized = accounts.map(serializeDecimal);
    return NextResponse.json(serialized);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
