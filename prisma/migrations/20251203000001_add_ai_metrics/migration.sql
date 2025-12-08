-- Criar tabela AIMetric
CREATE TABLE IF NOT EXISTS "AIMetric" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "instanceId" TEXT,
  "model" TEXT NOT NULL,
  "promptTokens" INTEGER NOT NULL DEFAULT 0,
  "completionTokens" INTEGER NOT NULL DEFAULT 0,
  "totalTokens" INTEGER NOT NULL DEFAULT 0,
  "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "duration" INTEGER NOT NULL DEFAULT 0,
  "cached" BOOLEAN NOT NULL DEFAULT false,
  "endpoint" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIMetric_pkey" PRIMARY KEY ("id")
);

-- Criar índices
CREATE INDEX IF NOT EXISTS "AIMetric_userId_idx" ON "AIMetric"("userId");
CREATE INDEX IF NOT EXISTS "AIMetric_instanceId_idx" ON "AIMetric"("instanceId");
CREATE INDEX IF NOT EXISTS "AIMetric_userId_createdAt_idx" ON "AIMetric"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AIMetric_createdAt_idx" ON "AIMetric"("createdAt");
CREATE INDEX IF NOT EXISTS "AIMetric_model_idx" ON "AIMetric"("model");

-- Adicionar foreign keys
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AIMetric_userId_fkey'
  ) THEN
    ALTER TABLE "AIMetric" ADD CONSTRAINT "AIMetric_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AIMetric_instanceId_fkey'
  ) THEN
    ALTER TABLE "AIMetric" ADD CONSTRAINT "AIMetric_instanceId_fkey" 
      FOREIGN KEY ("instanceId") REFERENCES "WhatsAppInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

