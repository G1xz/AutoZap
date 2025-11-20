-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN     "isAIOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiBusinessDetails" TEXT;

