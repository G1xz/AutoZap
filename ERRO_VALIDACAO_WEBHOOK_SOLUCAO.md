# 🔧 Erro de Validação do Webhook - Solução

O Meta não consegue validar o webhook. Vamos resolver isso passo a passo.

---

## ✅ Passo 1: Verificar Token no Vercel

1. **Vercel** → Settings → Environment Variables
2. Procure por `WEBHOOK_VERIFY_TOKEN`
3. **Verifique o valor:**
   - Deve ser exatamente: `r5S1uAJvQ9hhHRX8C7Pen4I2LxMgzmWc0`
   - **Sem espaços** antes ou depois
   - **Sem quebras de linha**

4. **Se estiver diferente:**
   - Edite e corrija
   - Faça **redeploy**

---

## ✅ Passo 2: Verificar Token no Meta

1. **No Meta**, no campo "Verificar token"
2. **Verifique:**
   - Deve ser exatamente: `r5S1uAJvQ9hhHRX8C7Pen4I2LxMgzmWc0`
   - **Sem espaços** antes ou depois
   - **Sem caracteres extras**

3. **Se estiver diferente:**
   - Apague e cole novamente
   - Certifique-se que é **exatamente igual** ao do Vercel

---

## ✅ Passo 3: Testar URL Manualmente

Teste se o endpoint está respondendo:

1. **Abra no navegador:**
   ```
   https://autoflow.dev.br/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=r5S1uAJvQ9hhHRX8C7Pen4I2LxMgzmWc0&hub.challenge=teste123
   ```

2. **O que deve acontecer:**
   - Deve retornar apenas: `teste123`
   - **Sem** JSON, **sem** HTML, **sem** erro
   - Apenas o texto: `teste123`

3. **Se não retornar `teste123`:**
   - Há problema no código do webhook
   - Verifique os logs do Vercel

---

## ✅ Passo 4: Verificar Logs do Vercel

1. **Vercel** → Deployments → Último deploy → Logs
2. **Tente verificar no Meta novamente**
3. **Procure nos logs:**
   - `Verificação webhook` → Deve aparecer
   - `Verificação webhook OK` → Deve aparecer se funcionar
   - `Verificação webhook falhou` → Se aparecer, há problema

---

## ✅ Passo 5: Verificar se Fez Redeploy

**Importante:** Se você adicionou ou editou `WEBHOOK_VERIFY_TOKEN` no Vercel:

1. **Você precisa fazer redeploy:**
   - Vercel → Deployments
   - Clique nos 3 pontinhos do último deploy
   - Clique em **"Redeploy"**
   - Aguarde terminar

2. **Só depois** tente verificar no Meta

---

## ✅ Passo 6: Verificar URL no Meta

**URL deve ser exatamente:**
```
https://autoflow.dev.br/api/whatsapp/webhook
```

**Verifique:**
- ✅ Começa com `https://` (não `http://`)
- ✅ Não tem espaços
- ✅ Não tem `?instanceId=xxx` no final
- ✅ Termina com `/api/whatsapp/webhook`

---

## 🔍 Possíveis Problemas

### Problema 1: Token Não Corresponde

**Sintoma:** Erro de validação  
**Solução:**
- Verifique se o token no Meta é **exatamente igual** ao do Vercel
- Copie e cole novamente
- Certifique-se que não há espaços

### Problema 2: URL Não Está Acessível

**Sintoma:** Erro de validação  
**Solução:**
- Teste a URL manualmente no navegador
- Verifique se o domínio está funcionando
- Verifique se há firewall bloqueando

### Problema 3: Redeploy Não Foi Feito

**Sintoma:** Token configurado mas não funciona  
**Solução:**
- Faça redeploy após adicionar/editar variável
- Aguarde o deploy terminar
- Tente verificar novamente

### Problema 4: Rate Limiting

**Sintoma:** Funciona às vezes, falha outras  
**Solução:**
- Aguarde alguns minutos
- Tente novamente

---

## 🧪 Teste Rápido

1. **Teste a URL:**
   ```
   https://autoflow.dev.br/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=r5S1uAJvQ9hhHRX8C7Pen4I2LxMgzmWc0&hub.challenge=teste123
   ```
   Deve retornar: `teste123`

2. **Se retornar `teste123`:**
   - ✅ Endpoint está funcionando
   - ✅ Token está correto
   - ✅ Tente verificar no Meta novamente

3. **Se não retornar `teste123`:**
   - ❌ Há problema no código
   - ❌ Verifique os logs do Vercel
   - ❌ Verifique se o token está correto no Vercel

---

## ✅ Checklist Final

- [ ] Token no Vercel: `r5S1uAJvQ9hhHRX8C7Pen4I2LxMgzmWc0`
- [ ] Token no Meta: `r5S1uAJvQ9hhHRX8C7Pen4I2LxMgzmWc0` (exatamente igual)
- [ ] URL no Meta: `https://autoflow.dev.br/api/whatsapp/webhook`
- [ ] Redeploy feito (se editou variável)
- [ ] Teste manual retorna `teste123`
- [ ] Tente verificar no Meta novamente

---

**Teste a URL manualmente primeiro e me diga o que retorna!**

