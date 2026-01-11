# 🚨 Webhook Não Recebe Mensagens - Diagnóstico

O webhook está verificado, mas não está recebendo mensagens. Vamos diagnosticar:

---

## ✅ Passo 1: Verificar Eventos no Meta

**O mais comum:** Eventos não estão marcados!

1. **Meta for Developers** → WhatsApp → Configuração
2. Role até a seção **"Webhook"**
3. Procure por **"Campos de assinatura"** ou **"Subscription Fields"**
4. **Verifique se está marcado:**
   - ✅ **`messages`** (obrigatório - mensagens recebidas)
   - ✅ **`messaging_postbacks`** (opcional - respostas de botões)

**Se não estiver marcado:**
- Marque `messages`
- Salve
- Aguarde alguns segundos

---

## ✅ Passo 2: Verificar se Webhook Está Verificado

1. **Meta for Developers** → WhatsApp → Configuração
2. Na seção **"Webhook"**
3. **Verifique o status:**
   - Deve aparecer: **"Verificado"** ou check verde ✅
   - Se aparecer erro ou não verificado, há problema

---

## ✅ Passo 3: Verificar Número Conectado

1. **No sistema**, vá na instância conectada
2. **Verifique:**
   - Status: **"Conectado"** ou **"Connected"**
   - Phone Number ID está preenchido?
   - Número de telefone está preenchido?

3. **No Meta:**
   - Verifique se o número está realmente conectado ao app
   - Verifique se o número está ativo

---

## ✅ Passo 4: Testar Envio de Mensagem

1. **Envie uma mensagem** do WhatsApp para o número conectado
2. **Aguarde 5-10 segundos**
3. **Verifique os logs do Vercel:**
   - Vercel → Deployments → Último deploy → Logs
   - Procure por: `Webhook recebido` ou `Mensagens recebidas no webhook`

**Se aparecer nos logs:**
- ✅ Webhook está recebendo!
- ✅ Sistema deve processar automaticamente

**Se NÃO aparecer nos logs:**
- ❌ Webhook não está recebendo
- ❌ Verifique eventos no Meta (Passo 1)

---

## 🔍 O Que Procurar nos Logs

### Se Funcionar:
```
Webhook recebido
Mensagens recebidas no webhook
Phone Number ID: 123456789
Instância encontrada: Nome (id)
Processando mensagem: {...}
```

### Se Não Funcionar:
```
(nenhum log de webhook)
```

---

## ❌ Possíveis Problemas

### Problema 1: Eventos Não Marcados
**Sintoma:** Nada aparece nos logs  
**Solução:** Marque `messages` no Meta

### Problema 2: Webhook Não Verificado
**Sintoma:** Status não mostra "Verificado"  
**Solução:** Verifique novamente no Meta

### Problema 3: Número Não Conectado
**Sintoma:** Instância não está conectada  
**Solução:** Reconecte o número

### Problema 4: Phone Number ID Não Corresponde
**Sintoma:** Mensagem chega mas não encontra instância  
**Solução:** Verifique se `phoneId` da instância corresponde ao número

---

## ✅ Checklist

- [ ] Evento `messages` marcado no Meta
- [ ] Webhook está "Verificado" no Meta
- [ ] Instância está "Conectada" no sistema
- [ ] Phone Number ID está preenchido
- [ ] Teste enviando mensagem
- [ ] Verificou logs do Vercel

---

**Verifique primeiro se o evento `messages` está marcado no Meta! Isso é o mais comum! 🎯**

