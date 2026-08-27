import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

function buildTitle(text) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "New Chat";
  return clean.length > 72 ? `${clean.slice(0, 69)}...` : clean;
}

export async function GET(req) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { clerkUserId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const requestedSessionId = searchParams.get("sessionId");

    let sessions = await db.chatSession.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    // One-time bootstrap for legacy messages that existed before sessions.
    if (!sessions.length) {
      const legacyCount = await db.chatMessage.count({
        where: { userId: user.id, sessionId: null },
      });
      if (legacyCount > 0) {
        const legacySession = await db.chatSession.create({
          data: {
            userId: user.id,
            title: "Previous Chat",
          },
        });
        await db.chatMessage.updateMany({
          where: { userId: user.id, sessionId: null },
          data: { sessionId: legacySession.id },
        });

        sessions = await db.chatSession.findMany({
          where: { userId: user.id },
          orderBy: { updatedAt: "desc" },
          include: {
            _count: {
              select: { messages: true },
            },
          },
        });
      }
    }

    const activeSessionId = requestedSessionId || sessions[0]?.id || null;

    const messages = activeSessionId
      ? await db.chatMessage.findMany({
          where: { userId: user.id, sessionId: activeSessionId },
          orderBy: { createdAt: "asc" },
        })
      : [];

    return NextResponse.json({
      success: true,
      activeSessionId,
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: s._count.messages,
      })),
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { clerkUserId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const title = buildTitle(body?.title || "");

    const session = await db.chatSession.create({
      data: {
        userId: user.id,
        title,
      },
    });

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: 0,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
