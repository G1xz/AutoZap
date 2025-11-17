# 🔑 Gerar Token Temporário para Teste

## 🎯 Objetivo

Gerar um token de acesso temporário para testar se o webhook funciona.

---

## 📋 Passo a Passo

### 1. Acessar Graph API Explorer

1. Acesse: https://developers.facebook.com/tools/explorer/
2. Selecione seu App no dropdown superior
3. Selecione a versão da API (ex: `v18.0`)

### 2. Gerar Token Temporário

**Opção A: Token de Usuário (para teste rápido)**
1. No Graph API Explorer
2. Clique em **"Gerar token de acesso"**
3. Selecione as permissões:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
   - `business_management`
4. Clique em **"Gerar token de acesso"**
5. Copie o token gerado

**Opção B: Token do Sistema (mais estável)**
1. Meta for Developers → Seu App → Configurações → Básico
2. Role até "Token de acesso do sistema"
3. Clique em **"Gerar token de acesso do sistema"**
4. Selecione as permissões necessárias
5. Copie o token gerado

---

## ⚠️ Importante

**O token temporário:**
- ✅ Válido por 1-2 horas (token de usuário)
- ✅ Válido por 60 dias (token do sistema)
- ✅ Serve para testes rápidos
- ❌ Não é permanente

**Para produção:**
- Use token permanente (já configurado)
- Ou configure OAuth para obter tokens permanentes

---

## 🧪 Testar com Token Temporário

### 1. Atualizar Token na Instância

**Opção A: Via Interface**
1. Painel → Instâncias → Configurar
2. Cole o token temporário no campo "Access Token"
3. Salve

**Opção B: Via Banco de Dados**
- Atualize o campo `accessToken` da instância

### 2. Testar Webhook

1. Envie uma mensagem para o número
2. Veja os logs do Vercel
3. Deve aparecer: `📨 Webhook recebido: {...}`

---

## 🔍 Verificar se Funcionou

**Nos logs do Vercel, deve aparecer:**
```
📨 Webhook recebido: {...}
🔍 Phone Number ID: 123456789
✅ Instância encontrada: Nome (id)
📩 Processando mensagem: {...}
```

**Se aparecer:** ✅ Funcionou!

**Se não aparecer:** 
- Verifique se o webhook está configurado no Meta
- Verifique se a URL está correta
- Verifique se o token de verificação está correto

---

## 💡 Dica

**O problema pode não ser o token de acesso!**

O webhook funciona independente do token de acesso. O que importa é:
1. ✅ URL do webhook configurada corretamente
2. ✅ Token de verificação (`WEBHOOK_VERIFY_TOKEN`) correto
3. ✅ Eventos selecionados (`messages`)

**O access token é usado para:**
- Enviar mensagens
- Não para receber (webhook)

---

## 🚀 Próximos Passos

1. Gere o token temporário
2. Teste enviando uma mensagem
3. Veja os logs
4. Me diga o que apareceu!




