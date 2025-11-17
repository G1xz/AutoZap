# 📊 Como Verificar Logs do Vercel

## 🎯 Objetivo

Verificar se o webhook está recebendo mensagens e identificar problemas.

---

## 📋 Passo a Passo

### 1. Acessar Logs do Vercel

1. Acesse: https://vercel.com
2. Faça login
3. Selecione seu projeto: **AutoZap**
4. Clique em **"Deployments"** (no menu lateral)
5. Clique no deployment mais recente (o que tem o commit mais novo)

### 2. Ver Logs em Tempo Real

1. No deployment, clique na aba **"Logs"**
2. Os logs aparecem em tempo real
3. **Importante:** Deixe essa aba aberta enquanto testa

### 3. Enviar Mensagem de Teste

1. Envie uma mensagem para o número do WhatsApp
2. Volte para os logs do Vercel
3. Veja o que aparece

---

## 🔍 O Que Procurar nos Logs

### ✅ Se Está Funcionando:

Você verá algo assim:
```
📨 Webhook recebido: {...}
🔍 Phone Number ID: 123456789
✅ Instância encontrada: Nome da Instância (id)
📩 Processando mensagem: {...}
🔄 Workflow "Nome do Workflow" acionado para 5511999999999
```

### ❌ Se NÃO Está Funcionando:

**Problema 1: Webhook não recebe nada**
```
(nada aparece nos logs)
```
**Causa:** Webhook não configurado no Meta ou URL errada

**Problema 2: PhoneId não corresponde**
```
📨 Webhook recebido: {...}
🔍 Phone Number ID: 123456789
❌ Instância não encontrada para phoneId: 123456789
📋 Instâncias disponíveis: [...]
```
**Causa:** O `phoneId` salvo não corresponde ao que vem no webhook

**Problema 3: Instância desativada**
```
✅ Instância encontrada: Nome (id)
⚠️ Instância Nome (id) está desativada. Mensagem ignorada.
```
**Causa:** Campo `active` está `false` no banco

**Problema 4: Workflow não acionado**
```
✅ Instância encontrada: Nome (id)
📩 Processando mensagem: {...}
(não aparece workflow acionado)
```
**Causa:** 
- Não há workflow ativo
- Trigger não corresponde à mensagem
- Workflow não está associado à instância

---

## 📸 Exemplo de Logs Corretos

```
00:10:23.456 📨 Webhook recebido: {
  "entry": [{
    "changes": [{
      "value": {
        "metadata": {
          "phone_number_id": "123456789"
        },
        "messages": [{
          "from": "5511999999999",
          "text": { "body": "oi" },
          "type": "text"
        }]
      }
    }]
  }]
}
00:10:23.457 🔍 Phone Number ID: 123456789
00:10:23.458 ✅ Instância encontrada: Minha Instância (abc123)
00:10:23.459 📩 Processando mensagem: { from: "5511999999999", text: { body: "oi" } }
00:10:23.460 🔄 Workflow "Resposta Automática" acionado para 5511999999999
```

---

## 🛠️ Próximos Passos

1. **Envie uma mensagem**
2. **Veja os logs do Vercel**
3. **Me diga o que aparece**
4. **Aí eu te ajudo a resolver!** 🚀

---

## 💡 Dica

Se não aparecer nada nos logs:
- Verifique se o webhook está "Verificado" no Meta
- Verifique se a URL está correta
- Aguarde alguns segundos (pode ter delay)




