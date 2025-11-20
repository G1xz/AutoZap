# 🔧 Aplicar Migration - Passo a Passo

## ⚠️ Erro Atual
```
The column `isAIOnly` does not exist in the current database.
```

Isso significa que a migration ainda não foi aplicada no banco de dados.

---

## ✅ Solução: Aplicar Migration Manualmente

### Passo 1: Acessar o Banco de Dados

1. **Se estiver usando Neon:**
   - Acesse: https://console.neon.tech
   - Faça login
   - Selecione seu projeto
   - Clique em **"SQL Editor"** no menu lateral

2. **Se estiver usando Supabase:**
   - Acesse: https://supabase.com/dashboard
   - Selecione seu projeto
   - Vá em **"SQL Editor"** no menu lateral

3. **Se estiver usando outro serviço:**
   - Acesse o dashboard do seu banco
   - Encontre a opção de **SQL Editor** ou **Query Tool**

---

### Passo 2: Executar o SQL

Copie e cole este SQL no editor:

```sql
-- Adiciona coluna isAIOnly
ALTER TABLE "Workflow" 
ADD COLUMN IF NOT EXISTS "isAIOnly" BOOLEAN NOT NULL DEFAULT false;

-- Adiciona coluna aiBusinessDetails
ALTER TABLE "Workflow" 
ADD COLUMN IF NOT EXISTS "aiBusinessDetails" TEXT;
```

**OU** use o arquivo `apply_migration.sql` que foi criado na raiz do projeto (tem verificações de segurança).

---

### Passo 3: Verificar se Funcionou

Execute esta query para verificar:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Workflow' 
AND column_name IN ('isAIOnly', 'aiBusinessDetails');
```

Você deve ver 2 linhas retornadas:
- `isAIOnly` | boolean
- `aiBusinessDetails` | text

---

### Passo 4: Testar no Sistema

1. Volte para o sistema
2. Tente criar um novo fluxo IA-only
3. O erro não deve mais aparecer

---

## 🔍 Alternativa: Via Terminal (se tiver acesso)

Se você tem acesso ao banco via terminal local:

```bash
# Verificar status das migrations
npx prisma migrate status

# Aplicar migrations pendentes
npx prisma migrate deploy
```

---

## ✅ Pronto!

Após aplicar a migration, você poderá:
- ✅ Criar fluxos IA-only
- ✅ Configurar detalhes do negócio
- ✅ Usar a IA autônoma para conversar com clientes

---

## 📝 Nota de Segurança

As colunas adicionadas têm valores padrão seguros:
- `isAIOnly` = `false` (não afeta workflows existentes)
- `aiBusinessDetails` = `null` (opcional)

Nenhum dado existente será afetado! 🎉

