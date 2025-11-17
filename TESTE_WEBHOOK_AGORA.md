# 🧪 Teste do Webhook - Agora!

## ✅ Token Configurado

**Token na Vercel:**
```
autozap_webhook_2024_secreto
```

**Token no Meta (deve ser):**
```
autozap_webhook_2024_secreto
```

---

## 🧪 Teste 1: Verificar no Navegador

Abra esta URL no navegador:

```
https://auto-zap-snsb.vercel.app/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=autozap_webhook_2024_secreto&hub.challenge=teste123
```

**O que deve aparecer:**
- ✅ Se aparecer `teste123` → **Funciona!**
- ❌ Se aparecer erro → Problema no token ou código

---

## 🧪 Teste 2: Verificar no Meta

1. Acesse: Meta for Developers → WhatsApp → Configuração
2. Verifique se o token está: `autozap_webhook_2024_secreto` (só o valor, sem `WEBHOOK_VERIFY_TOKEN=`)
3. Clique em **"Verificar e salvar"**
4. Veja o que acontece:
   - ✅ Se aparecer check verde → **Funciona!**
   - ❌ Se aparecer erro → Me diga qual erro

---

## 🧪 Teste 3: Ver Logs do Vercel

1. Vercel → Deployments → Logs
2. Tente verificar no Meta (ou envie mensagem)
3. Veja o que aparece:
   - `🔍 Verificação webhook:` → Está recebendo
   - `🔑 Token global configurado: Sim` → Token está lá
   - `✅ Verificação OK` → Funcionou!

---

## 🚨 Se Não Funcionar

### Problema 1: Token Não Corresponde

**Sintoma:** Erro ao verificar no Meta

**Solução:**
1. Verifique se no Meta está exatamente: `autozap_webhook_2024_secreto`
2. Sem espaços antes/depois
3. Sem `WEBHOOK_VERIFY_TOKEN=` no início

### Problema 2: Webhook Não Responde

**Sintoma:** Nada aparece nos logs

**Solução:**
1. Aguarde o deploy terminar (pode levar 1-2 minutos)
2. Tente novamente

### Problema 3: Token Não Está na Vercel

**Sintoma:** Logs mostram "Token global configurado: Não"

**Solução:**
1. Vercel → Settings → Environment Variables
2. Verifique se `WEBHOOK_VERIFY_TOKEN` está lá
3. Se não estiver, adicione
4. Faça redeploy

---

## 📋 Checklist Final

- [ ] Token na Vercel: `autozap_webhook_2024_secreto` ✅
- [ ] Token no Meta: `autozap_webhook_2024_secreto` (só o valor)
- [ ] URL no Meta: `https://auto-zap-snsb.vercel.app/api/whatsapp/webhook`
- [ ] Evento `messages` marcado
- [ ] Clicou em "Verificar e salvar"
- [ ] Testou enviar mensagem

---

## 🎯 Próximos Passos

1. **Teste a URL no navegador** (Teste 1)
2. **Tente verificar no Meta** (Teste 2)
3. **Veja os logs** (Teste 3)
4. **Me diga o que aconteceu!**

Aí eu te ajudo a resolver! 🚀




