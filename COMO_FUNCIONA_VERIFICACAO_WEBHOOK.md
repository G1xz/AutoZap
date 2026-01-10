# 🔍 Como Funciona a Verificação do Webhook

## 📖 Entendendo o Processo

### 1. Teste Manual no Navegador (O que você está fazendo)

Quando você acessa a URL no navegador:
```
https://autoflow.dev.br/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=teste123
```

**O que acontece:**
- ✅ Você está testando **diretamente** o endpoint
- ✅ O Meta **NÃO está envolvido** nesse teste
- ✅ É apenas para verificar se o código está funcionando

**Se retornar erro:**
- ❌ Significa que há problema no código
- ❌ O Meta também não vai conseguir verificar

---

### 2. Verificação do Meta (O que o Meta faz)

Quando você clica em **"Verificar e salvar"** no Meta:

1. **O Meta envia uma requisição GET** para sua URL:
   ```
   GET https://autoflow.dev.br/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=ABC123
   ```

2. **Seu servidor deve:**
   - Verificar se `hub.mode === 'subscribe'`
   - Verificar se `hub.verify_token` corresponde ao token configurado
   - **Retornar APENAS o `hub.challenge`** (sem JSON, sem HTML)

3. **Se retornar o challenge corretamente:**
   - ✅ Meta marca como "Verificado"
   - ✅ Webhook configurado com sucesso

4. **Se retornar erro:**
   - ❌ Meta mostra erro
   - ❌ Webhook não é verificado

---

## 🔍 Por Que Está Dando Erro?

Se o teste manual está retornando `{"error":"Token inválido"}`, significa que:

1. **O código está sendo executado** ✅
2. **Mas o token não está sendo validado** ❌

**Possíveis causas:**
- Token no Vercel não está sendo lido corretamente
- Token no Meta não corresponde ao do Vercel
- Há algum problema na lógica de verificação

---

## ✅ O Que Fazer Agora

### Passo 1: Verificar Logs do Vercel

1. **Vercel** → Deployments → Último deploy → Logs
2. **Teste a URL novamente** no navegador
3. **Procure nos logs** por:
   - `Verificação webhook` → Deve aparecer
   - `hasGlobalToken: true` → Se aparecer, token está sendo lido
   - `Token global encontrado` → Se aparecer, token está configurado
   - `tokenMatches: true/false` → Mostra se corresponde
   - `Token global não corresponde` → Se aparecer, token está diferente

### Passo 2: Verificar Token no Meta

1. **No Meta**, no campo "Verificar token"
2. **Copie o token** que está lá
3. **Compare** com o token do Vercel: `r5S1uAJvQ9hhHRX8C7Pen4I2LxMgzmWc0`
4. **São exatamente iguais?**
   - Se não: Apague e cole novamente no Meta
   - Se sim: O problema é outro

### Passo 3: Verificar se Token Está Sendo Lido

Nos logs do Vercel, procure por:
- `hasGlobalToken: false` → Token não está sendo lido (problema na variável)
- `hasGlobalToken: true` → Token está sendo lido ✅

---

## 🎯 Resumo

**Teste Manual:**
- Você testa diretamente no navegador
- Meta não está envolvido
- Se der erro, o Meta também não vai conseguir verificar

**Verificação do Meta:**
- Meta envia requisição automaticamente
- Seu servidor deve retornar apenas o challenge
- Se retornar erro, Meta mostra erro

**Solução:**
- Verificar logs do Vercel
- Verificar se token corresponde
- Corrigir o problema no código se necessário

---

**Verifique os logs do Vercel e me diga o que aparece! Isso vai mostrar exatamente onde está o problema! 🔍**

