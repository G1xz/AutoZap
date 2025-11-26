-- Adiciona campos endDate e duration ao modelo Appointment
-- Calcula endDate baseado em date + duration para registros existentes

-- Adiciona coluna duration (nullable, sem default - vem do serviço)
ALTER TABLE "Appointment" ADD COLUMN "duration" INTEGER;

-- Para registros existentes, define duração padrão de 60 minutos (apenas para compatibilidade)
UPDATE "Appointment" 
SET "duration" = 60
WHERE "duration" IS NULL;

-- Adiciona coluna endDate calculando baseado em date + duration para registros existentes
ALTER TABLE "Appointment" ADD COLUMN "endDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Atualiza endDate para registros existentes (date + duration minutos)
UPDATE "Appointment" 
SET "endDate" = "date" + (COALESCE("duration", 60) || ' minutes')::INTERVAL
WHERE "endDate" = CURRENT_TIMESTAMP;

-- Remove o DEFAULT de endDate agora que todos os registros foram atualizados
ALTER TABLE "Appointment" ALTER COLUMN "endDate" DROP DEFAULT;

-- Adiciona índice para consultas de sobreposição
CREATE INDEX IF NOT EXISTS "Appointment_date_endDate_idx" ON "Appointment"("date", "endDate");

