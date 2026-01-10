# ✅ Token Configurado - Próximos Passos

O token está configurado no Vercel! Agora vamos garantir que funcione.

---

## ✅ Passo 1: Fazer Redeploy (IMPORTANTE!)

**Se você acabou de adicionar a variável, precisa fazer redeploy:**

1. **Vercel** → Deployments
2. Clique nos **3 pontinhos** (⋯) do último deploy
3. Clique em **"Redeploy"**
4. **Aguarde terminar** (pode levar 1-2 minutos)

**⚠️ Sem redeploy, a variável não será aplicada!**

---

## ✅ Passo 2: Verificar Token no Meta

1. **No Meta for Developers**, no campo "Verificar token"
2. **Verifique se é exatamente:**
   ```
   r5S1uAJvQ9hhHRX8C7Pen4I2LxMgzmWc0
   ```
3. **Sem espaços** antes ou depois
4. **Sem caracteres extras**

**Se estiver diferente:**
- Apague e cole novamente
- Certifique-se que é **exatamente igual** ao do Vercel

---

## ✅ Passo 3: Testar URL Completa

Teste com a URL completa (não apenas `hub.me`):

```
https://autoflow.dev.br/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=r5S1uAJvQ9hhHRX8C7Pen4I2LxMgzmWc0&hub.challenge=teste123
```

**Deve retornar:** `teste123` (não JSON de erro)

---

## ✅ Passo 4: Verificar Logs do Vercel

Após fazer redeploy e testar:

1. **Vercel** → Deployments → Último deploy → Logs
2. **Procure por:**
   - `Verificação webhook` → Deve aparecer
   - `Token global encontrado` → Se aparecer, token está sendo lido
   - `tokenMatches: true` → Se aparecer, token corresponde
   - `WEBHOOK_VERIFY_TOKEN não configurado` → Se aparecer, precisa redeploy

---

## 🔍 Diagnóstico pelos Logs

### Se aparecer: "Token global encontrado"
✅ Token está sendo lido do Vercel

### Se aparecer: "tokenMatches: true"
✅ Token corresponde corretamente

### Se aparecer: "tokenMatches: false"
❌ Token não corresponde
- Verifique se o token no Meta é exatamente igual ao do Vercel
- Verifique se não há espaços

### Se aparecer: "WEBHOOK_VERIFY_TOKEN não configurado"
❌ Variável não está disponível
- Precisa fazer redeploy
- Ou variável não foi salva corretamente

---

## ✅ Checklist

- [ ] Token configurado no Vercel ✅ (já está!)
- [ ] **Redeploy feito** (após adicionar variável)
- [ ] Token no Meta é exatamente igual
- [ ] Teste com URL completa
- [ ] Verificou logs do Vercel

---

## 🧪 Teste Final

1. **Faça redeploy** (se ainda não fez)
2. **Aguarde terminar**
3. **Teste a URL completa:**
   ```
   https://autoflow.dev.br/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=r5S1uAJvQ9hhHRX8C7Pen4I2LxMgzmWc0&hub.challenge=teste123
   ```
4. **Deve retornar:** `teste123`
5. **Se funcionar:** Tente verificar no Meta novamente

---

**Faça o redeploy e teste novamente! 🚀**

