import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

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

    const { id } = await params;
    const exists = await db.account.findUnique({ where: { id } });
    if (!exists)
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
      });

    await db.account.delete({ where: { id } });

    try {
      await logAdminAction({
        actorId: admin.id,
        actorClerkId: userId,
        action: "delete_account",
        resource: "account",
        resourceId: id,
        ip: req.headers.get("x-forwarded-for") || null,
        userAgent: req.headers.get("user-agent") || null,
      });
    } catch (e) {
      console.error("audit log failed", e);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("/api/admin/accounts/[id] DELETE error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
