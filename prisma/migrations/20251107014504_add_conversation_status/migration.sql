-- CreateTable
CREATE TABLE "ConversationStatus" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationStatus_instanceId_status_idx" ON "ConversationStatus"("instanceId", "status");

-- CreateIndex
CREATE INDEX "ConversationStatus_status_idx" ON "ConversationStatus"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationStatus_instanceId_contactNumber_key" ON "ConversationStatus"("instanceId", "contactNumber");

-- AddForeignKey
ALTER TABLE "ConversationStatus" ADD CONSTRAINT "ConversationStatus_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WhatsAppInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
