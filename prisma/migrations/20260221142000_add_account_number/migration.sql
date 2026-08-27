-- Add optional bank account number for user accounts
ALTER TABLE "accounts"
ADD COLUMN "bankAccountNumber" TEXT;

-- Prevent duplicate account numbers per user
CREATE UNIQUE INDEX "accounts_userId_bankAccountNumber_key"
ON "accounts"("userId", "bankAccountNumber");
