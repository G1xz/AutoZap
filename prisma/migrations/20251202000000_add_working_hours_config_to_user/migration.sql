-- Adiciona coluna workingHoursConfig ao modelo User
-- Esta coluna armazena configuração de horários de funcionamento em JSON

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "workingHoursConfig" TEXT;


