# 📡 Webhook: URL Única para Todas as Instâncias

Problema resolvido! Agora você usa **UMA URL única** para todas as instâncias.

---

## ✅ Como Funciona Agora

### 1. URL Única (Sem instanceId)

**URL do Webhook:**
```
https://auto-zap-snsb.vercel.app/api/whatsapp/webhook
```

**Importante:**
- ✅ **Mesma URL** para todas as instâncias
- ✅ **Não precisa** do instanceId na URL
- ✅ **Funciona** para todos os clientes

### 2. Identificação Automática

O sistema identifica automaticamente qual instância usar:

**No POST (receber mensagens):**
- Meta envia `phone_number_id` no webhook
- Sistema busca instância pelo `phoneId`
- Funciona automaticamente! ✅

**No GET (verificação):**
- Sistema tenta verificar com token global
- Ou busca instância pelo token
- Funciona automaticamente! ✅

---

## 🔧 Como Configurar no Meta for Developers

### Passo 1: URL de Callback

Cole esta URL (mesma para todos):
```
https://auto-zap-snsb.vercel.app/api/whatsapp/webhook
```

**Não precisa** do `?instanceId=xxx`!

### Passo 2: Token de Verificação

**Opção A: Token Global (Recomendado)**

Adicione no `.env`:
```env
WEBHOOK_VERIFY_TOKEN=seu_token_secreto_aqui
```

Use este token no Meta for Developers.

**Opção B: Token de Uma Instância**

Se não tiver token global:
1. Pegue o token de qualquer instância
2. Use no Meta for Developers
3. Funciona para todas (sistema tenta todas)

---

## 🎯 Vantagens

### Antes (Problema):
- ❌ Cada instância precisava de URL diferente
- ❌ Tinha que trocar no Meta para cada cliente
- ❌ Não fazia sentido

### Agora (Solução):
- ✅ **Uma URL única** para todos
- ✅ **Não precisa trocar** nada
- ✅ **Funciona automaticamente** para todos os clientes

---

## 📋 Configuração Completa

### 1. Adicionar Token Global (Opcional mas Recomendado)

No `.env`:
```env
WEBHOOK_VERIFY_TOKEN=meu_token_secreto_123
```

Na Vercel também:
- Settings → Environment Variables
- Adicione `WEBHOOK_VERIFY_TOKEN`

### 2. Configurar no Meta for Developers

**URL de Callback:**
```
https://auto-zap-snsb.vercel.app/api/whatsapp/webhook
```

**Token de Verificação:**
- Se tiver `WEBHOOK_VERIFY_TOKEN`: use ele
- Se não tiver: use token de qualquer instância

**Eventos:**
- ✅ messages
- ✅ messaging_postbacks

### 3. Pronto!

Agora funciona para **todas as instâncias** automaticamente! 🚀

---

## ✅ Resumo

**URL (mesma para todos):**
```
https://auto-zap-snsb.vercel.app/api/whatsapp/webhook
```

**Token:**
- Token global (se configurado)
- Ou token de qualquer instância

**Resultado:**
- ✅ Uma URL para todos
- ✅ Não precisa trocar nada
- ✅ Funciona automaticamente

---

Problema resolvido! 🎉

