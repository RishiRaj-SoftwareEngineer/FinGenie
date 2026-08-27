CREATE TABLE "chat_sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chat_sessions_userId_createdAt_idx"
ON "chat_sessions"("userId", "createdAt");

ALTER TABLE "chat_sessions"
ADD CONSTRAINT "chat_sessions_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages"
ADD COLUMN "sessionId" TEXT;

CREATE INDEX "chat_messages_sessionId_createdAt_idx"
ON "chat_messages"("sessionId", "createdAt");

ALTER TABLE "chat_messages"
ADD CONSTRAINT "chat_messages_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
