# 🔧 Aplicar Migration para slotConfig

O erro ocorre porque a coluna `slotConfig` não existe no banco de dados de produção.

## ✅ Solução Rápida

### Opção 1: Via API (MAIS FÁCIL)

1. **Acesse esta URL no navegador (depois de fazer login no sistema):**
   ```
   https://seu-dominio.vercel.app/api/migrate/apply
   ```

2. **Ou execute via curl:**
   ```bash
   curl https://seu-dominio.vercel.app/api/migrate/apply
   ```

3. **Você verá uma resposta JSON confirmando que a coluna foi criada**

---

### Opção 2: SQL Direto no Banco

1. **Acesse o dashboard do seu banco (Neon/Supabase)**
2. **Execute este SQL:**

```sql
-- Adiciona coluna slotConfig ao modelo User
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "slotConfig" TEXT;
```

---

### Opção 3: Via Prisma Migrate (Se tiver acesso local)

Execute no terminal local (com acesso ao banco):

```bash
npx prisma migrate deploy
```

Isso aplicará todas as migrations pendentes, incluindo a `20251201000000_add_slot_config_to_user`.

---

## ✅ Verificar se Funcionou

Execute esta query para verificar:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'User' 
AND column_name = 'slotConfig';
```

Você deve ver 1 linha retornada:
- `slotConfig` | text | YES

---

## 📝 Nota

A migration adiciona a coluna `slotConfig` ao modelo `User`:
- Tipo: `TEXT` (nullable)
- Armazena configuração de slots de agendamento em JSON
- Formato: `{ slotSizeMinutes: number, bufferMinutes?: number }`

A coluna é nullable, então não há risco de quebrar dados existentes.

---

## 🎯 Depois de Aplicar

1. **O erro não deve mais aparecer**
2. **O sistema usará valores padrão (15 minutos, sem buffer) até que o usuário configure**

---

## 📞 Se ainda não funcionar

Me avise qual método você tentou e qual erro apareceu!

