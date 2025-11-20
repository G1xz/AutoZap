# 🔧 Aplicar Migration para Fluxos IA-Only

O erro ocorre porque a migration ainda não foi aplicada no banco de dados de produção.

## ✅ Solução Rápida

### Opção 1: Via Prisma Migrate (Recomendado)

Execute no terminal local (com acesso ao banco):

```bash
npx prisma migrate deploy
```

Isso aplicará todas as migrations pendentes, incluindo a `20251120230000_add_ai_only_workflow`.

### Opção 2: SQL Manual (Se Prisma não funcionar)

Execute este SQL diretamente no seu banco de dados (Neon, Supabase, etc):

```sql
ALTER TABLE "Workflow" 
ADD COLUMN "isAIOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "aiBusinessDetails" TEXT;
```

### Opção 3: Via Vercel (Produção)

Se você tem acesso ao banco via Vercel:

1. Acesse o dashboard do seu banco de dados (Neon, Supabase, etc)
2. Vá em "SQL Editor" ou "Query"
3. Execute o SQL acima
4. Faça redeploy na Vercel

## ✅ Verificar se Funcionou

Após aplicar a migration, teste criando um novo fluxo IA-only. O erro não deve mais aparecer.

## 📝 Nota

A migration adiciona duas colunas:
- `isAIOnly`: Boolean para identificar fluxos exclusivos de IA
- `aiBusinessDetails`: Text para armazenar os detalhes do negócio em JSON

Ambas têm valores padrão seguros, então não há risco de quebrar dados existentes.

