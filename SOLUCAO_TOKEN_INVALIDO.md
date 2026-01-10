# 🔧 Solução: Token Inválido no Webhook

O erro `{"error":"Token inválido"}` significa que o token não está sendo validado. Vamos resolver:

---

## ✅ Solução 1: Verificar Token no Vercel

### Passo 1: Verificar se Token Está Configurado

1. **Vercel** → Settings → Environment Variables
2. Procure por `WEBHOOK_VERIFY_TOKEN`
3. **Verifique:**
   - ✅ Está configurado?
   - ✅ Valor é: `r5S1uAJvQ9hhHRX8C7Pen4I2LxMgzmWc0`?
   - ✅ Sem espaços antes/depois?

### Passo 2: Se Não Estiver Configurado

1. **Adicione:**
   - Name: `WEBHOOK_VERIFY_TOKEN`
   - Value: `r5S1uAJvQ9hhHRX8C7Pen4I2LxMgzmWc0`
   - Environment: Production (e Preview/Development se quiser)

2. **Salve**

3. **Faça redeploy:**
   - Deployments → 3 pontinhos → Redeploy
   - Aguarde terminar

### Passo 3: Testar Novamente

1. Teste a URL:
   ```
   https://autoflow.dev.br/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=r5S1uAJvQ9hhHRX8C7Pen4I2LxMgzmWc0&hub.challenge=teste123
   ```

2. **Deve retornar:** `teste123` (não JSON de erro)

---

## ✅ Solução 2: Usar Token da Instância

Se você conectou via Facebook OAuth, o sistema pode ter gerado um token automaticamente:

### Passo 1: Verificar Token da Instância

1. No sistema, vá na instância conectada
2. Procure por **"Token de Verificação"** ou **"Webhook Verify Token"**
3. **Copie o token**

### Passo 2: Usar no Meta

1. No Meta, campo **"Verificar token"**
2. Cole o token da instância
3. Salve e verifique

---

## ✅ Solução 3: Verificar Logs do Vercel

Após fazer as mudanças acima:

1. **Vercel** → Deployments → Último deploy → Logs
2. **Teste a URL novamente**
3. **Procure nos logs:**
   - `Verificação webhook` → Deve aparecer
   - `Token global encontrado` → Se aparecer, token está configurado
   - `WEBHOOK_VERIFY_TOKEN não configurado` → Se aparecer, precisa configurar
   - `Token global não corresponde` → Se aparecer, token está errado

---

## 🔍 Diagnóstico

### Se aparecer: "WEBHOOK_VERIFY_TOKEN não configurado"
**Solução:** Adicione a variável no Vercel e faça redeploy

### Se aparecer: "Token global não corresponde"
**Solução:** 
- Verifique se o token no Vercel é exatamente igual ao do Meta
- Copie e cole novamente
- Certifique-se que não há espaços

### Se não aparecer nada nos logs
**Solução:**
- Verifique se o deploy foi concluído
- Aguarde alguns segundos
- Tente novamente

---

## ✅ Checklist

- [ ] `WEBHOOK_VERIFY_TOKEN` configurado no Vercel
- [ ] Valor: `r5S1uAJvQ9hhHRX8C7Pen4I2LxMgzmWc0`
- [ ] Sem espaços antes/depois
- [ ] Redeploy feito após adicionar variável
- [ ] Token no Meta é exatamente igual
- [ ] Teste manual retorna `teste123` (não erro JSON)

---

## 🧪 Teste Final

Depois de configurar tudo:

1. **Teste a URL:**
   ```
   https://autoflow.dev.br/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=r5S1uAJvQ9hhHRX8C7Pen4I2LxMgzmWc0&hub.challenge=teste123
   ```

2. **Deve retornar:** `teste123`

3. **Se retornar `teste123`:**
   - ✅ Funcionou!
   - ✅ Tente verificar no Meta novamente

4. **Se ainda retornar erro:**
   - Verifique os logs do Vercel
   - Me diga o que aparece nos logs

---

**Configure o token no Vercel e faça redeploy! Depois teste novamente! 🚀**

