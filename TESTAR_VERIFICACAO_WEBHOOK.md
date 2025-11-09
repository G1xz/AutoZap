# 🧪 Testar Verificação do Webhook

## 🎯 Objetivo

Testar se o webhook está respondendo corretamente à verificação do Meta.

---

## 📋 Teste Manual

### 1. Testar URL do Webhook

Abra no navegador (ou use curl):

```
https://auto-zap-snsb.vercel.app/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=SEU_TOKEN_AQUI&hub.challenge=123456
```

**Substitua:**
- `SEU_TOKEN_AQUI` pelo valor do `WEBHOOK_VERIFY_TOKEN` (ou token da instância)

**O que deve acontecer:**
- ✅ Deve retornar `123456` (o challenge)
- ❌ Se retornar erro, há problema

---

### 2. Verificar Token no Código

O token que você colocou no Meta deve ser:
- O valor do `WEBHOOK_VERIFY_TOKEN` no `.env` (se configurado?)
- OU o `webhookVerifyToken` de uma instância

**Verifique:**
1. Qual token você colocou no Meta?
2. Esse token está no `WEBHOOK_VERIFY_TOKEN`?
3. Ou está no `webhookVerifyToken` de alguma instância?

---

## 🔍 Possíveis Problemas

### Problema 1: Token Não Corresponde

**Sintoma:** Webhook não verifica

**Solução:**
1. Veja qual token está no Meta
2. Verifique se está no `WEBHOOK_VERIFY_TOKEN` (Vercel)
3. Ou verifique se está no `webhookVerifyToken` de alguma instância

### Problema 2: Variável Não Configurada na Vercel

**Sintoma:** Token correto mas não funciona

**Solução:**
1. Vercel → Settings → Environment Variables
2. Adicione `WEBHOOK_VERIFY_TOKEN` com o valor
3. Faça redeploy

### Problema 3: Webhook Não Está "Verificado"

**Sintoma:** Tudo preenchido mas não funciona

**Solução:**
1. No Meta, clique em "Verificar e salvar" novamente
2. Veja se aparece erro
3. Se aparecer erro, veja qual é

---

## 🛠️ Debug Passo a Passo

### Passo 1: Verificar Token

**Pergunta:** Qual token você colocou no Meta?

**Opções:**
- A) O valor do `WEBHOOK_VERIFY_TOKEN` do `.env`
- B) O `webhookVerifyToken` de uma instância
- C) Outro token

### Passo 2: Verificar Variável na Vercel

1. Vercel → Settings → Environment Variables
2. Procure `WEBHOOK_VERIFY_TOKEN`
3. Está configurada? Com qual valor?

### Passo 3: Testar URL Manualmente

Cole no navegador:
```
https://auto-zap-snsb.vercel.app/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=teste123
```

**Substitua `SEU_TOKEN` pelo token que está no Meta**

**Resultado esperado:**
- ✅ Retorna `teste123` → Funciona!
- ❌ Retorna erro → Problema no token ou código

---

## 💡 Dica Importante

**O token no Meta deve ser EXATAMENTE igual a:**
- O valor do `WEBHOOK_VERIFY_TOKEN` (se configurado)
- OU o `webhookVerifyToken` de alguma instância

**Não pode ter:**
- Espaços antes/depois
- Caracteres diferentes
- Maiúsculas/minúsculas diferentes

---

## 🚀 Próximos Passos

1. **Me diga:** Qual token você colocou no Meta?
2. **Me diga:** Esse token está no `WEBHOOK_VERIFY_TOKEN` da Vercel?
3. **Teste:** A URL manualmente (passo 3 acima)
4. **Me diga:** O que retornou?

Aí eu te ajudo a resolver! 🎯

