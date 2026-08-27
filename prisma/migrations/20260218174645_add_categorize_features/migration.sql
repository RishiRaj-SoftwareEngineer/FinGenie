-- CreateTable
CREATE TABLE "category_rules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorize_runs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preview" BOOLEAN NOT NULL DEFAULT false,
    "threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "totalInput" INTEGER NOT NULL DEFAULT 0,
    "totalApplied" INTEGER NOT NULL DEFAULT 0,
    "revertedAt" TIMESTAMP(3),

    CONSTRAINT "categorize_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorize_updates" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "oldCategory" TEXT,
    "newCategory" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorize_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_rules_userId_idx" ON "category_rules"("userId");

-- CreateIndex
CREATE INDEX "categorize_runs_userId_idx" ON "categorize_runs"("userId");

-- CreateIndex
CREATE INDEX "categorize_updates_runId_idx" ON "categorize_updates"("runId");

-- AddForeignKey
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorize_runs" ADD CONSTRAINT "categorize_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorize_updates" ADD CONSTRAINT "categorize_updates_runId_fkey" FOREIGN KEY ("runId") REFERENCES "categorize_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
