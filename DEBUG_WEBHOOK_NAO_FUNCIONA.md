# 🐛 Debug: Webhook Não Funciona

## ✅ Checklist de Verificação

### 1. Webhook Configurado no Meta?

**Verificar:**
- ✅ URL: `https://auto-zap-snsb.vercel.app/api/whatsapp/webhook`
- ✅ Token: O valor do `WEBHOOK_VERIFY_TOKEN` (ou token da instância)
- ✅ Eventos: `messages` e `messaging_postbacks`
- ✅ Status: Deve mostrar "Verificado" (check verde)

**Como verificar:**
1. Meta for Developers → Seu App → WhatsApp → Configuração
2. Verifique se o webhook está "Verificado"
3. Se não estiver, clique em "Verificar e salvar"

---

### 2. Variável de Ambiente Configurada?

**No `.env` local:**
```env
WEBHOOK_VERIFY_TOKEN=seu_token_aqui
```

**Na Vercel:**
1. Vercel Dashboard → Seu Projeto → Settings → Environment Variables
2. Adicione `WEBHOOK_VERIFY_TOKEN` com o mesmo valor

**Importante:** Faça redeploy após adicionar variável na Vercel!

---

### 3. Instância Está Ativa?

**Verificar no banco:**
- Campo `active` deve ser `true`
- Se estiver `false`, a mensagem não será processada

**Como verificar:**
- Veja no painel da aplicação se a instância está ativa
- Ou verifique diretamente no banco de dados

---

### 4. PhoneId Está Correto?

**O problema mais comum:**

O `phoneId` salvo na instância pode não corresponder ao `phone_number_id` que vem no webhook.

**Como verificar:**
1. Envie uma mensagem para o número
2. Veja os logs do Vercel (Deployments → Logs)
3. Procure por: `🔍 Phone Number ID:`
4. Compare com o `phoneId` salvo na instância

**Se não corresponder:**
- O webhook não consegue identificar a instância
- Precisa atualizar o `phoneId` na instância

---

### 5. Logs do Vercel

**Como verificar:**
1. Vercel Dashboard → Seu Projeto → Deployments
2. Clique no deployment mais recente
3. Aba "Logs"
4. Envie uma mensagem e veja os logs em tempo real

**O que procurar:**
- `📨 Webhook recebido:` - Confirma que o webhook está recebendo
- `🔍 Phone Number ID:` - Mostra o ID que veio no webhook
- `✅ Instância encontrada:` - Confirma que encontrou a instância
- `❌ Instância não encontrada:` - Problema! PhoneId não corresponde
- `📋 Instâncias disponíveis:` - Lista todas as instâncias para debug

---

### 6. Workflow Configurado?

**Verificar:**
- ✅ Há workflow ativo?
- ✅ O trigger está correto?
- ✅ O workflow está associado à instância?

**Como verificar:**
- Painel → Workflows
- Veja se há workflows ativos
- Verifique o trigger (palavra-chave que aciona)

---

## 🔍 Passo a Passo de Debug

### Passo 1: Verificar Webhook no Meta

1. Meta for Developers → Seu App → WhatsApp → Configuração
2. Verifique se está "Verificado"
3. Se não estiver, verifique URL e token

### Passo 2: Verificar Logs do Vercel

1. Vercel → Deployments → Logs
2. Envie uma mensagem
3. Veja se aparece `📨 Webhook recebido:`

**Se não aparecer:**
- Webhook não está configurado corretamente no Meta
- Ou URL está errada

**Se aparecer mas não processar:**
- Veja o próximo passo

### Passo 3: Verificar PhoneId

Nos logs, procure:
```
🔍 Phone Number ID: 123456789
❌ Instância não encontrada para phoneId: 123456789
📋 Instâncias disponíveis: [...]
```

**Se aparecer isso:**
- O `phoneId` salvo não corresponde ao que vem no webhook
- Precisa atualizar o `phoneId` na instância

### Passo 4: Verificar Instância Ativa

Nos logs, se aparecer:
```
✅ Instância encontrada: Nome (id)
```

Mas não processar, verifique:
- Campo `active` da instância
- Se está `false`, ative a instância

---

## 🛠️ Soluções Comuns

### Problema 1: "Instância não encontrada"

**Causa:** `phoneId` não corresponde

**Solução:**
1. Veja o `phone_number_id` nos logs
2. Atualize o `phoneId` da instância no banco
3. Ou reconecte a instância pelo OAuth

### Problema 2: Webhook não recebe nada

**Causa:** Webhook não configurado ou URL errada

**Solução:**
1. Verifique URL no Meta: `https://auto-zap-snsb.vercel.app/api/whatsapp/webhook`
2. Verifique token
3. Clique em "Verificar e salvar" no Meta

### Problema 3: Recebe mas não processa

**Causa:** Instância inativa ou workflow não configurado

**Solução:**
1. Ative a instância
2. Configure workflow com trigger correto

---

## 📞 Próximos Passos

1. Verifique os logs do Vercel
2. Envie uma mensagem
3. Me diga o que aparece nos logs
4. Aí eu te ajudo a resolver! 🚀




