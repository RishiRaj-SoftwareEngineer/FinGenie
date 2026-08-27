import { auth } from "@clerk/nextjs/server";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/prisma";

export async function GET(req) {
  try {
    const { userId } = await auth();
    if (!userId)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });

    const admin = await db.user.findUnique({ where: { clerkUserId: userId } });
    if (!admin || admin.role !== "ADMIN")
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
      });

    // load all settings and return as key -> value object
    const rows = await db.setting.findMany();
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    return new Response(JSON.stringify({ settings }), { status: 200 });
  } catch (err) {
    console.error("/api/admin/settings GET error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

export async function POST(req) {
  try {
    const { userId } = await auth();
    if (!userId)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });

    const admin = await db.user.findUnique({ where: { clerkUserId: userId } });
    if (!admin || admin.role !== "ADMIN")
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
      });

    const body = await req.json();
    // upsert each key/value pair
    const entries = Object.entries(body || {});
    for (const [key, value] of entries) {
      await db.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    try {
      await logAdminAction({
        actorId: admin.id,
        actorClerkId: userId,
        action: "update_settings",
        resource: "settings",
        data: body,
        ip: req.headers.get("x-forwarded-for") || null,
        userAgent: req.headers.get("user-agent") || null,
      });
    } catch (e) {
      console.error("audit log failed", e);
    }

    // return the latest settings
    const rows = await db.setting.findMany();
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    return new Response(JSON.stringify({ success: true, settings }), {
      status: 200,
    });
  } catch (err) {
    console.error("/api/admin/settings POST error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
