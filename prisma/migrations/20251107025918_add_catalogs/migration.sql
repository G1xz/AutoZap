-- CreateTable
CREATE TABLE "Catalog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogNode" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "positionX" DOUBLE PRECISION NOT NULL,
    "positionY" DOUBLE PRECISION NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogConnection" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "sourceHandle" TEXT,
    "targetHandle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Catalog_userId_idx" ON "Catalog"("userId");

-- CreateIndex
CREATE INDEX "Catalog_userId_isActive_idx" ON "Catalog"("userId", "isActive");

-- CreateIndex
CREATE INDEX "CatalogConnection_catalogId_idx" ON "CatalogConnection"("catalogId");

-- CreateIndex
CREATE INDEX "CatalogConnection_sourceNodeId_idx" ON "CatalogConnection"("sourceNodeId");

-- CreateIndex
CREATE INDEX "CatalogConnection_targetNodeId_idx" ON "CatalogConnection"("targetNodeId");

-- AddForeignKey
ALTER TABLE "Catalog" ADD CONSTRAINT "Catalog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogNode" ADD CONSTRAINT "CatalogNode_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogConnection" ADD CONSTRAINT "CatalogConnection_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogConnection" ADD CONSTRAINT "CatalogConnection_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "CatalogNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogConnection" ADD CONSTRAINT "CatalogConnection_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "CatalogNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
