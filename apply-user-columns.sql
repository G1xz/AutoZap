-- Script para adicionar colunas faltantes na tabela User
-- Execute este SQL diretamente no seu banco de dados

-- Adiciona coluna slotConfig se não existir
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "slotConfig" TEXT;

-- Adiciona coluna workingHoursConfig se não existir
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "workingHoursConfig" TEXT;

-- Verifica se as colunas foram criadas
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'User' 
AND column_name IN ('slotConfig', 'workingHoursConfig')
ORDER BY column_name;


