-- Adiciona coluna slotConfig ao modelo User
-- Esta coluna armazena configuração de slots de agendamento em JSON

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "slotConfig" TEXT;

