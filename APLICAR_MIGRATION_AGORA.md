# 🚀 Aplicar Migration AGORA - Solução Rápida

## ✅ Método 1: Via API (MAIS FÁCIL)

1. **Acesse esta URL no navegador (depois de fazer login no sistema):**
   ```
   https://seu-dominio.vercel.app/api/migrate/apply
   ```

2. **Ou execute via curl:**
   ```bash
   curl https://seu-dominio.vercel.app/api/migrate/apply
   ```

3. **Você verá uma resposta JSON confirmando que as colunas foram criadas**

---

## ✅ Método 2: SQL Direto no Banco

1. **Acesse o dashboard do seu banco (Neon/Supabase)**
2. **Execute este SQL:**

```sql
-- Remove as colunas se existirem (para recriar limpo)
ALTER TABLE "Workflow" DROP COLUMN IF EXISTS "isAIOnly";
ALTER TABLE "Workflow" DROP COLUMN IF EXISTS "aiBusinessDetails";

-- Cria as colunas novamente
ALTER TABLE "Workflow" 
ADD COLUMN "isAIOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "aiBusinessDetails" TEXT;
```

---

## ✅ Método 3: Reset Completo (se nada funcionar)

⚠️ **ATENÇÃO: Isso vai apagar TODOS os dados!**

```bash
# Localmente
npx prisma migrate reset --force

# Depois aplica todas as migrations
npx prisma migrate deploy
```

---

## 🎯 Depois de Aplicar

1. **Regenere o Prisma Client:**
   ```bash
   npx prisma generate
   ```

2. **Teste criando um novo fluxo IA-only**

3. **O erro deve desaparecer!**

---

## 📞 Se ainda não funcionar

Me avise qual método você tentou e qual erro apareceu!

