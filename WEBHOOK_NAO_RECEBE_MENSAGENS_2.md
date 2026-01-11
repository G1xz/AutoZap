# 🔍 Webhook Não Recebe Mensagens - Diagnóstico Avançado

O evento `messages` está ativo, mas mensagens não aparecem nos logs. Vamos verificar outras causas:

---

## ✅ Passo 1: Verificar se Webhook Está Realmente Verificado

1. **Meta for Developers** → WhatsApp → Configuração
2. Na seção **"Webhook"**
3. **Verifique o status:**
   - Deve aparecer: **"Verificado"** ou check verde ✅
   - Se aparecer erro ou não verificado, há problema

**Se não estiver verificado:**
- Clique em **"Verificar e salvar"** novamente
- Aguarde alguns segundos

---

## ✅ Passo 2: Verificar Número Conectado

1. **No sistema**, vá na instância conectada
2. **Verifique:**
   - Status: **"Conectado"** ou **"Connected"**?
   - **Phone Number ID** está preenchido?
   - **Número de telefone** está preenchido?

3. **Anote o Phone Number ID** da instância

---

## ✅ Passo 3: Verificar se Número Está no App Correto

1. **Meta for Developers** → WhatsApp → Configuração Inicial
2. Procure por **"Números de telefone"** ou **"Phone Numbers"**
3. **Verifique:**
   - O número que você está usando está listado?
   - Está conectado ao app correto?

---

## ✅ Passo 4: Testar com Logs Detalhados

1. **Vercel** → Deployments → Último deploy → Logs
2. **Deixe os logs abertos**
3. **Envie uma mensagem** do WhatsApp para o número conectado
4. **Aguarde 10-15 segundos**
5. **Procure por QUALQUER coisa relacionada a webhook:**
   - `Webhook recebido`
   - `POST /api/whatsapp/webhook`
   - `Mensagens recebidas`
   - Qualquer erro relacionado

**Se aparecer QUALQUER coisa:**
- ✅ Webhook está recebendo (mesmo que dê erro depois)
- ✅ Problema pode ser na identificação da instância

**Se NÃO aparecer NADA:**
- ❌ Meta não está enviando requisições
- ❌ Verifique se webhook está realmente verificado

---

## ✅ Passo 5: Verificar Phone Number ID

O sistema identifica a instância pelo `phoneId`. Se o `phoneId` salvo não corresponder ao que vem no webhook, a mensagem não será processada.

1. **No sistema**, veja qual `phoneId` está salvo na instância
2. **No Meta**, verifique qual `phoneId` está associado ao número
3. **Compare:** São iguais?

**Se forem diferentes:**
- Reconecte o número via Facebook OAuth
- Ou atualize o `phoneId` manualmente

---

## 🔍 Possíveis Problemas

### Problema 1: Webhook Não Está Realmente Verificado
**Sintoma:** Status não mostra "Verificado"  
**Solução:** Verifique novamente no Meta

### Problema 2: Número Não Está Conectado ao App
**Sintoma:** Número não aparece na lista do app  
**Solução:** Conecte o número ao app no Meta

### Problema 3: Phone Number ID Não Corresponde
**Sintoma:** Mensagem chega mas não encontra instância  
**Solução:** Reconecte o número ou atualize `phoneId`

### Problema 4: Número de Teste
**Sintoma:** Usando número de teste  
**Solução:** Números de teste têm limitações, use número real

---

## ✅ Checklist

- [ ] Evento `messages` está ativo ✅ (já confirmado)
- [ ] Webhook está "Verificado" no Meta
- [ ] Instância está "Conectada" no sistema
- [ ] Phone Number ID está preenchido
- [ ] Número está conectado ao app no Meta
- [ ] Testou enviando mensagem
- [ ] Verificou logs do Vercel (qualquer coisa relacionada a webhook)

---

**Verifique se o webhook está realmente "Verificado" e se o número está conectado ao app! 🎯**

