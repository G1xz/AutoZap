# 🔍 Webhook Verificado Mas Não Recebe Mensagens

O webhook está verificado, mas mensagens não aparecem nos logs. Possíveis causas:

---

## ✅ Passo 1: Verificar se Número Está Conectado ao App

1. **Meta for Developers** → WhatsApp → Configuração Inicial
2. Procure por **"Números de telefone"** ou **"Phone Numbers"**
3. **Verifique:**
   - O número que você está usando está listado?
   - Está conectado ao app correto (AutoZap)?

**Se não estiver listado:**
- O número não está conectado ao app
- Precisa conectar o número ao app primeiro

---

## ✅ Passo 2: Verificar Phone Number ID

O sistema identifica a instância pelo `phoneId`. Se não corresponder, a mensagem não será processada.

1. **No sistema**, vá na instância conectada
2. **Anote o Phone Number ID** que está salvo
3. **No Meta**, verifique qual Phone Number ID está associado ao número
4. **Compare:** São iguais?

**Se forem diferentes:**
- Reconecte o número via Facebook OAuth
- Ou atualize o `phoneId` manualmente

---

## ✅ Passo 3: Verificar se Número Está Usando o Webhook Correto

1. **Meta for Developers** → WhatsApp → Configuração
2. Na seção **"Webhook"**
3. **Verifique a URL:**
   - Deve ser: `https://autoflow.dev.br/api/whatsapp/webhook`
   - Não deve ter `?instanceId=xxx` no final

4. **Verifique se está aplicado ao número:**
   - Alguns números podem ter webhooks diferentes
   - Verifique se o número está usando o webhook correto

---

## ✅ Passo 4: Testar com Logs Detalhados

Adicionei um log mais detalhado. Após fazer deploy:

1. **Vercel** → Deployments → Último deploy → Logs
2. **Deixe os logs abertos**
3. **Envie uma mensagem** do WhatsApp para o número conectado
4. **Aguarde 10-15 segundos**
5. **Procure por:**
   - `🔍 WEBHOOK POST RECEBIDO:` → Se aparecer, webhook está recebendo!
   - `POST /api/whatsapp/webhook` → Requisição chegou
   - Qualquer coisa relacionada a webhook

**Se aparecer `🔍 WEBHOOK POST RECEBIDO:`:**
- ✅ Webhook está recebendo!
- ✅ Problema pode ser na identificação da instância
- ✅ Verifique Phone Number ID

**Se NÃO aparecer nada:**
- ❌ Meta não está enviando requisições
- ❌ Verifique se número está conectado ao app
- ❌ Verifique se número está usando o webhook correto

---

## ✅ Passo 5: Verificar se É Número de Teste

Se você está usando um **número de teste**:

- Números de teste têm limitações
- Podem não enviar webhooks corretamente
- Recomendação: Use número real

---

## 🔍 Possíveis Problemas

### Problema 1: Número Não Está Conectado ao App
**Sintoma:** Número não aparece na lista do app  
**Solução:** Conecte o número ao app no Meta

### Problema 2: Phone Number ID Não Corresponde
**Sintoma:** Mensagem chega mas não encontra instância  
**Solução:** Reconecte o número ou atualize `phoneId`

### Problema 3: Número Está Usando Webhook Diferente
**Sintoma:** Webhook verificado mas não recebe  
**Solução:** Verifique se número está usando o webhook correto

### Problema 4: Número de Teste
**Sintoma:** Número de teste não funciona  
**Solução:** Use número real

---

## ✅ Checklist

- [ ] Webhook está "Verificado" ✅ (já confirmado)
- [ ] Evento `messages` está ativo ✅ (já confirmado)
- [ ] Número está conectado ao app no Meta
- [ ] Phone Number ID corresponde
- [ ] Número está usando o webhook correto
- [ ] Testou com logs abertos
- [ ] Verificou se aparece `🔍 WEBHOOK POST RECEBIDO:`

---

**Faça deploy das mudanças, teste com logs abertos e me diga se aparece `🔍 WEBHOOK POST RECEBIDO:` nos logs! 🔍**

