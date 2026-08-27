-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "contributions" ADD COLUMN     "lastAlertSent" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "lastAlertSent" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';
