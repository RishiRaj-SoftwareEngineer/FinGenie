import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });

    const admin = await db.user.findUnique({ where: { clerkUserId: userId } });
    if (!admin || admin.role !== "ADMIN") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
      });
    }

    const accounts = await db.account.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return new Response(JSON.stringify({ accounts }), { status: 200 });
  } catch (err) {
    console.error("/api/admin/accounts error", err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      { status: 500 },
    );
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
    if (!admin || admin.role !== "ADMIN") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
      });
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    const bankAccountNumber = String(body?.bankAccountNumber || "")
      .replace(/\D/g, "")
      .slice(0, 16);
    const type = String(body?.type || "CURRENT");
    const balance = Number(body?.balance || 0);
    const isDefault = Boolean(body?.isDefault);
    const ownerUserId = String(body?.userId || admin.id);

    if (!name) {
      return new Response(
        JSON.stringify({ error: "Account name is required" }),
        { status: 400 },
      );
    }
    if (!/^\d{16}$/.test(bankAccountNumber)) {
      return new Response(
        JSON.stringify({
          error: "Bank account number must be exactly 16 digits",
        }),
        { status: 400 },
      );
    }
    if (!["CURRENT", "SAVINGS"].includes(type)) {
      return new Response(JSON.stringify({ error: "Invalid account type" }), {
        status: 400,
      });
    }
    if (!Number.isFinite(balance)) {
      return new Response(JSON.stringify({ error: "Invalid balance amount" }), {
        status: 400,
      });
    }

    const owner = await db.user.findUnique({ where: { id: ownerUserId } });
    if (!owner) {
      return new Response(JSON.stringify({ error: "Owner user not found" }), {
        status: 404,
      });
    }

    const existingAccounts = await db.account.findMany({
      where: { userId: owner.id },
      select: { id: true, isDefault: true },
    });
    const shouldBeDefault = existingAccounts.length === 0 ? true : isDefault;

    if (shouldBeDefault) {
      await db.account.updateMany({
        where: { userId: owner.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    let created;
    try {
      created = await db.account.create({
        data: {
          userId: owner.id,
          name,
          bankAccountNumber,
          type,
          balance,
          isDefault: shouldBeDefault,
        },
      });
    } catch (createError) {
      const msg = String(createError?.message || "");
      if (
        msg.includes("Unique constraint") &&
        msg.includes("bankAccountNumber")
      ) {
        return new Response(
          JSON.stringify({
            error:
              "This bank account number already exists for this user. Use a different number.",
          }),
          { status: 409 },
        );
      }
      throw createError;
    }

    try {
      await logAdminAction({
        actorId: admin.id,
        actorClerkId: userId,
        action: "create_account",
        resource: "account",
        resourceId: created.id,
        data: {
          userId: owner.id,
          name: created.name,
          type: created.type,
          isDefault: created.isDefault,
        },
        ip: req.headers.get("x-forwarded-for") || null,
        userAgent: req.headers.get("user-agent") || null,
      });
    } catch (auditError) {
      console.error("audit log failed", auditError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        account: {
          id: created.id,
          name: created.name,
          type: created.type,
          balance: created.balance?.toString?.() ?? String(created.balance ?? 0),
          userId: created.userId,
        },
      }),
      { status: 201 },
    );
  } catch (err) {
    console.error("/api/admin/accounts POST error", err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      { status: 500 },
    );
  }
}
