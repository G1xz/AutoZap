-- CreateTable
CREATE TABLE "PendingAppointment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "contactName" TEXT,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "duration" INTEGER,
    "service" TEXT NOT NULL,
    "description" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingAppointment_instanceId_contactNumber_key" ON "PendingAppointment"("instanceId", "contactNumber");

-- CreateIndex
CREATE INDEX "PendingAppointment_userId_idx" ON "PendingAppointment"("userId");

-- CreateIndex
CREATE INDEX "PendingAppointment_instanceId_contactNumber_idx" ON "PendingAppointment"("instanceId", "contactNumber");

-- CreateIndex
CREATE INDEX "PendingAppointment_expiresAt_idx" ON "PendingAppointment"("expiresAt");

-- AddForeignKey
ALTER TABLE "PendingAppointment" ADD CONSTRAINT "PendingAppointment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingAppointment" ADD CONSTRAINT "PendingAppointment_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WhatsAppInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

