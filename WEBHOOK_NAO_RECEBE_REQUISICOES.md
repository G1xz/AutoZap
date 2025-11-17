# 🚨 Webhook Não Recebe Requisições

## ❌ Problema Identificado

**Sintoma:** Nenhuma requisição aparece nos logs do Vercel para `/api/whatsapp/webhook`

**Causa:** O Meta não está enviando requisições para o webhook. Isso significa que a configuração no Meta for Developers está incorreta ou incompleta.

---

## ✅ Checklist de Verificação no Meta

### 1. Webhook Está Configurado?

**Onde verificar:**
1. Meta for Developers → https://developers.facebook.com
2. Selecione seu App
3. Menu lateral: **WhatsApp** → **Configuração**
4. Role até a seção **"Webhook"**

**O que deve aparecer:**
- ✅ Campo "URL de callback" preenchido
- ✅ Campo "Token de verificação" preenchido
- ✅ Botão "Verificar e salvar" (ou status "Verificado")

---

### 2. URL Está Correta?

**URL que deve estar configurada:**
```
https://auto-zap-snsb.vercel.app/api/whatsapp/webhook
```

**Verifique:**
- ✅ URL começa com `https://` (não `http://`)
- ✅ Não tem `?instanceId=xxx` no final
- ✅ Termina com `/api/whatsapp/webhook`
- ✅ Não tem espaços ou caracteres estranhos

---

### 3. Token Está Configurado?

**O que verificar:**
- ✅ Token está preenchido no campo "Token de verificação"
- ✅ É o mesmo valor que está no `WEBHOOK_VERIFY_TOKEN` (ou token da instância)
- ✅ Não tem espaços antes/depois

**Importante:** 
- Se você configurou `WEBHOOK_VERIFY_TOKEN=meu_token_123` no `.env`
- No Meta, deve estar apenas: `meu_token_123` (sem o nome da variável)

---

### 4. Webhook Foi Verificado?

**O que fazer:**
1. Preencha URL e Token
2. Clique em **"Verificar e salvar"**
3. Deve aparecer um check verde ✅ ou mensagem "Verificado"

**Se der erro:**
- Verifique URL e Token novamente
- Certifique-se que o deploy na Vercel está completo
- Aguarde alguns segundos e tente novamente

---

### 5. Eventos Estão Selecionados?

**O que verificar:**
- ✅ `messages` está marcado
- ✅ `messaging_postbacks` está marcado (opcional, mas recomendado)

**Como verificar:**
- Na mesma página do webhook
- Deve ter checkboxes para eventos
- Marque pelo menos `messages`

---

## 🔧 Passo a Passo para Configurar

### Passo 1: Acessar Configuração

1. https://developers.facebook.com
2. Seu App → WhatsApp → Configuração
3. Role até "Webhook"

### Passo 2: Preencher URL

```
https://auto-zap-snsb.vercel.app/api/whatsapp/webhook
```

### Passo 3: Preencher Token

**Opção A: Se você tem `WEBHOOK_VERIFY_TOKEN` no `.env`:**
- Pegue o valor (ex: `meu_token_123`)
- Cole no campo "Token de verificação"

**Opção B: Se não tem token global:**
- Pegue o `webhookVerifyToken` de uma instância
- Cole no campo "Token de verificação"

### Passo 4: Verificar

1. Clique em **"Verificar e salvar"**
2. Deve aparecer check verde ✅
3. Se der erro, verifique URL e Token

### Passo 5: Selecionar Eventos

1. Marque `messages`
2. Marque `messaging_postbacks` (opcional)
3. Salve

---

## 🧪 Testar

### 1. Enviar Mensagem

Envie uma mensagem para o número do WhatsApp.

### 2. Verificar Logs

1. Vercel → Deployments → Logs
2. Deve aparecer:
   ```
   📨 Webhook recebido: {...}
   ```

**Se aparecer:** ✅ Funcionou!

**Se não aparecer:** ❌ Ainda há problema na configuração

---

## ❓ Problemas Comuns

### Problema 1: "Falha ao verificar webhook"

**Causa:** URL ou Token incorretos

**Solução:**
- Verifique URL (deve ser exatamente como mostrado)
- Verifique Token (deve ser o valor, não a variável)
- Certifique-se que o deploy na Vercel está completo

### Problema 2: "Webhook verificado mas não recebe"

**Causa:** Eventos não selecionados

**Solução:**
- Marque pelo menos `messages` nos eventos
- Salve novamente

### Problema 3: "Nada aparece nos logs"

**Causa:** Webhook não configurado ou URL errada

**Solução:**
- Verifique se o webhook está realmente configurado
- Verifique se a URL está correta
- Tente verificar novamente

---

## 📸 Onde Encontrar no Meta

**Caminho completo:**
1. https://developers.facebook.com
2. Seu App (clique no nome)
3. Menu lateral: **WhatsApp**
4. Submenu: **Configuração**
5. Role até seção **"Webhook"**

**Ou:**
1. https://developers.facebook.com/apps
2. Selecione seu App
3. WhatsApp → Configuração → Webhook

---

## ✅ Resumo

**URL:**
```
https://auto-zap-snsb.vercel.app/api/whatsapp/webhook
```

**Token:**
- Valor do `WEBHOOK_VERIFY_TOKEN` (se configurado)
- Ou token de uma instância

**Eventos:**
- ✅ `messages` (obrigatório)
- ✅ `messaging_postbacks` (opcional)

**Ação:**
- Clique em "Verificar e salvar"
- Deve aparecer check verde ✅

---

Depois de configurar, envie uma mensagem e veja se aparece nos logs! 🚀




