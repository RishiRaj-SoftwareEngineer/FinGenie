import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });

    let user = await db.user.findUnique({ where: { clerkUserId: userId } });

    // If no DB record exists, attempt to fetch Clerk profile and create one automatically
    if (!user) {
      try {
        const profile = await clerkClient.users.getUser(userId);
        const email =
          profile.emailAddresses?.[0]?.emailAddress ||
          profile.primaryEmailAddress?.emailAddress ||
          null;
        const name =
          [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
          profile.fullName ||
          null;
        const imageUrl = profile.profileImageUrl || profile.imageUrl || null;

        if (!email) {
          return new Response(
            JSON.stringify({
              error:
                "Clerk profile has no email address; cannot create user row automatically.",
            }),
            { status: 400 },
          );
        }

        user = await db.user.create({
          data: {
            clerkUserId: userId,
            email,
            name,
            imageUrl,
            role: "ADMIN",
          },
        });
      } catch (err) {
        console.error("Failed to create DB user from Clerk profile", err);
        return new Response(
          JSON.stringify({
            error: "Failed to create DB user from Clerk profile",
          }),
          { status: 500 },
        );
      }
    } else {
      // If user exists, just promote
      await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
      try {
        await logAdminAction({
          actorId: user.id,
          actorClerkId: userId,
          action: "promote_self_to_admin",
          resource: "user",
          resourceId: user.id,
          ip: null,
          userAgent: null,
        });
      } catch (e) {
        console.error("audit log failed", e);
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error("/api/admin/promote-me error", err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      { status: 500 },
    );
  }
}
