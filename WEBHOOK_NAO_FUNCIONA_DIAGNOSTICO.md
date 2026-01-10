# 🚨 Webhook Não Funciona - Diagnóstico Completo

Você conectou o número, mas quando envia mensagem, nada acontece e não aparece nada nos logs. Isso significa que **o webhook não está recebendo as mensagens do Meta**.

---

## ✅ Passo 1: Verificar se Webhook Está Configurado no Meta

### Onde Verificar:

1. Acesse: https://developers.facebook.com
2. Selecione seu App (AutoZap)
3. Menu lateral: **WhatsApp** → **Configuração** (ou **"Getting Started"**)
4. Role até a seção **"Webhook"**

### O Que Deve Estar Configurado:

- ✅ **URL de callback** preenchida
- ✅ **Token de verificação** preenchido
- ✅ Status: **"Verificado"** ou check verde ✅
- ✅ Eventos marcados: **`messages`** (obrigatório)

---

## ✅ Passo 2: Configurar URL do Webhook

### URL Correta:

```
https://autoflow.dev.br/api/whatsapp/webhook
```

**⚠️ Importante:**
- Use `autoflow.dev.br` (seu domínio atual)
- Não use `auto-zap-snsb.vercel.app` (domínio antigo)
- Não precisa de `?instanceId=xxx` no final
- Deve começar com `https://`

### Como Configurar:

1. No Meta for Developers → WhatsApp → Configuração
2. Na seção **"Webhook"**
3. Campo **"URL de callback"**: Cole `https://autoflow.dev.br/api/whatsapp/webhook`
4. Salve

---

## ✅ Passo 3: Configurar Token de Verificação

### Opção A: Token Global (Recomendado)

1. **No Vercel:**
   - Settings → Environment Variables
   - Adicione: `WEBHOOK_VERIFY_TOKEN`
   - Valor: qualquer string secreta (ex: `meu_token_secreto_123`)
   - Salve

2. **No Meta:**
   - Campo **"Token de verificação"**: Cole o mesmo valor (ex: `meu_token_secreto_123`)
   - **Importante:** Cole só o valor, sem `WEBHOOK_VERIFY_TOKEN=`

3. **Faça redeploy** no Vercel

### Opção B: Token da Instância

Se você conectou via Facebook OAuth, o sistema gerou um token automaticamente:

1. **No sistema:**
   - Vá na instância que você criou
   - Procure por **"Token de Verificação"** ou **"Webhook Verify Token"**
   - Copie o token

2. **No Meta:**
   - Campo **"Token de verificação"**: Cole o token copiado
   - Salve

---

## ✅ Passo 4: Verificar Webhook

1. No Meta, após preencher URL e Token
2. Clique em **"Verificar e salvar"** ou **"Verify and Save"**
3. Deve aparecer:
   - ✅ Check verde
   - ✅ Mensagem "Verificado" ou "Verified"
   - ✅ Status mudando para "Verificado"

**Se der erro:**
- Verifique se a URL está correta
- Verifique se o token está correto
- Certifique-se que fez redeploy (se adicionou `WEBHOOK_VERIFY_TOKEN`)
- Aguarde alguns segundos e tente novamente

---

## ✅ Passo 5: Marcar Eventos

No Meta, na seção do webhook, marque:

- ✅ **`messages`** (obrigatório - mensagens recebidas)
- ✅ **`messaging_postbacks`** (opcional - respostas de botões)

---

## 🧪 Passo 6: Testar

1. **Envie uma mensagem** do WhatsApp para o número conectado
2. **Verifique os logs no Vercel:**
   - Vercel → Deployments → Último deploy → Logs
   - Procure por: `Webhook recebido` ou `Mensagens recebidas no webhook`

**Se aparecer nos logs:**
- ✅ Webhook está funcionando!
- ✅ Mensagem foi recebida
- ✅ Sistema deve processar automaticamente

**Se NÃO aparecer nos logs:**
- ❌ Webhook não está recebendo
- ❌ Verifique novamente a configuração no Meta
- ❌ Verifique se o webhook está "Verificado"

---

## 🔍 Diagnóstico: Por Que Não Aparece nos Logs?

### Possíveis Causas:

1. **Webhook não está configurado no Meta**
   - Solução: Configure seguindo os passos acima

2. **URL errada no Meta**
   - Solução: Use `https://autoflow.dev.br/api/whatsapp/webhook`

3. **Token errado**
   - Solução: Verifique se o token no Meta é igual ao do Vercel/instância

4. **Webhook não foi verificado**
   - Solução: Clique em "Verificar e salvar" no Meta

5. **Eventos não marcados**
   - Solução: Marque `messages` no Meta

6. **Número não está conectado corretamente**
   - Solução: Verifique se o `phoneId` da instância está correto

---

## 📋 Checklist Completo

- [ ] Webhook configurado no Meta for Developers
- [ ] URL: `https://autoflow.dev.br/api/whatsapp/webhook`
- [ ] Token de verificação configurado
- [ ] `WEBHOOK_VERIFY_TOKEN` adicionado no Vercel (se usar token global)
- [ ] Redeploy feito (se adicionou variável)
- [ ] Webhook verificado (check verde ✅)
- [ ] Evento `messages` marcado
- [ ] Teste enviando mensagem
- [ ] Verificou logs no Vercel

---

## 🎯 Próximos Passos

Depois que o webhook estiver funcionando:

1. ✅ Mensagens recebidas aparecerão nos logs
2. ✅ Sistema processará automaticamente
3. ✅ Workflows serão executados
4. ✅ Respostas automáticas funcionarão

---

## ❓ Ainda Não Funciona?

Se mesmo após seguir todos os passos não funcionar:

1. **Verifique o Phone Number ID:**
   - No sistema, veja qual `phoneId` está salvo na instância
   - No Meta, verifique se o número está conectado ao app correto

2. **Teste a URL do webhook manualmente:**
   - Acesse: `https://autoflow.dev.br/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=teste123`
   - Deve retornar: `teste123`
   - Se não retornar, há problema na configuração

3. **Verifique se o número está realmente conectado:**
   - No sistema, verifique se a instância mostra status "Conectado"
   - Verifique se o `phoneId` está preenchido

---

**Configure o webhook no Meta e teste novamente! 🚀**

