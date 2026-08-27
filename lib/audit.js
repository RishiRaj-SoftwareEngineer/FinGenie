import { db } from "./prisma";

export async function logAdminAction({
  actorId = null,
  actorClerkId = null,
  action,
  resource,
  resourceId = null,
  data = null,
  ip = null,
  userAgent = null,
}) {
  try {
    await db.auditLog.create({
      data: {
        actorId,
        actorClerkId,
        action,
        resource,
        resourceId,
        data,
        ip,
        userAgent,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log", err);
  }
}
