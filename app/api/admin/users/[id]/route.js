import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

// Handlers for /api/admin/users/[id]
export async function GET(req, { params }) {
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

    const user = await db.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user)
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
      });
    return new Response(JSON.stringify(user), { status: 200 });
  } catch (err) {
    console.error("/api/admin/users/[id] GET error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

export async function PATCH(req, { params }) {
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
    const { role, name } = body;

    const updates = {};
    if (role) updates.role = role;
    if (name !== undefined) updates.name = name;

    const updated = await db.user.update({
      where: { id: params.id },
      data: updates,
    });
    // audit
    try {
      await logAdminAction({
        actorId: admin.id,
        actorClerkId: userId,
        action: "update_user",
        resource: "user",
        resourceId: params.id,
        data: updates,
        ip: req.headers.get("x-forwarded-for") || null,
        userAgent: req.headers.get("user-agent") || null,
      });
    } catch (e) {
      console.error("audit log failed", e);
    }
    return new Response(JSON.stringify({ success: true, user: updated }), {
      status: 200,
    });
  } catch (err) {
    console.error("/api/admin/users/[id] PATCH error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

export async function DELETE(req, { params }) {
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

    await db.user.delete({ where: { id: params.id } });
    try {
      await logAdminAction({
        actorId: admin.id,
        actorClerkId: userId,
        action: "delete_user",
        resource: "user",
        resourceId: params.id,
        ip: req.headers.get("x-forwarded-for") || null,
        userAgent: req.headers.get("user-agent") || null,
      });
    } catch (e) {
      console.error("audit log failed", e);
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("/api/admin/users/[id] DELETE error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
