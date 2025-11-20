-- Migration para adicionar campos isAIOnly e aiBusinessDetails na tabela Workflow
-- Execute este SQL diretamente no seu banco de dados (Neon, Supabase, etc)

-- Verifica se as colunas já existem antes de adicionar
DO $$ 
BEGIN
    -- Adiciona isAIOnly se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Workflow' AND column_name = 'isAIOnly'
    ) THEN
        ALTER TABLE "Workflow" ADD COLUMN "isAIOnly" BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- Adiciona aiBusinessDetails se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Workflow' AND column_name = 'aiBusinessDetails'
    ) THEN
        ALTER TABLE "Workflow" ADD COLUMN "aiBusinessDetails" TEXT;
    END IF;
END $$;

-- Verifica se as colunas foram criadas
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'Workflow' 
AND column_name IN ('isAIOnly', 'aiBusinessDetails');

