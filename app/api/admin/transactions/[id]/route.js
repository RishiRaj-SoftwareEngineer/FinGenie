import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

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

    const tx = await db.transaction.findUnique({
      where: { id: params.id },
      include: { user: { select: { id: true, email: true } }, account: true },
    });
    if (!tx)
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
      });
    return new Response(JSON.stringify(tx), { status: 200 });
  } catch (err) {
    console.error("/api/admin/transactions/[id] GET error", err);
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
    const updates = {};
    if (body.amount != null) updates.amount = body.amount;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status) updates.status = body.status;
    if (body.date) updates.date = new Date(body.date);

    const updated = await db.transaction.update({
      where: { id: params.id },
      data: updates,
    });
    try {
      await logAdminAction({
        actorId: admin.id,
        actorClerkId: userId,
        action: "update_transaction",
        resource: "transaction",
        resourceId: params.id,
        data: updates,
        ip: req.headers.get("x-forwarded-for") || null,
        userAgent: req.headers.get("user-agent") || null,
      });
    } catch (e) {
      console.error("audit log failed", e);
    }
    return new Response(
      JSON.stringify({ success: true, transaction: updated }),
      { status: 200 },
    );
  } catch (err) {
    console.error("/api/admin/transactions/[id] PATCH error", err);
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

    await db.transaction.delete({ where: { id: params.id } });
    try {
      await logAdminAction({
        actorId: admin.id,
        actorClerkId: userId,
        action: "delete_transaction",
        resource: "transaction",
        resourceId: params.id,
        ip: req.headers.get("x-forwarded-for") || null,
        userAgent: req.headers.get("user-agent") || null,
      });
    } catch (e) {
      console.error("audit log failed", e);
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("/api/admin/transactions/[id] DELETE error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
