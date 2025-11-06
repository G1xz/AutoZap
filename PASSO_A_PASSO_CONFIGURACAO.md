# 📋 Passo a Passo - Configuração WhatsApp Cloud API

## 🎯 O que você precisa fazer

### PASSO 1: Criar Conta Meta Business

1. Acesse: **https://business.facebook.com**
2. Clique em "Criar Conta"
3. Preencha:
   - Nome da empresa
   - Seu nome
   - Email
4. Confirme o email

**✅ Resultado:** Você terá uma conta Meta Business

---

### PASSO 2: Criar App no Meta for Developers

1. Acesse: **https://developers.facebook.com**
2. Faça login com sua conta Meta Business
3. Clique em **"Meus Apps"** (canto superior direito)
4. Clique em **"Criar App"**
5. Escolha o tipo: **"Business"**
6. Preencha:
   - **Nome do App**: Ex: "WhatsApp Automation"
   - **Email de contato**: Seu email
   - **Finalidade do App**: Escolha "Gerenciar integrações de negócios"
7. Clique em **"Criar App"**

**✅ Resultado:** Você terá um App ID

---

### PASSO 3: Adicionar WhatsApp ao App

1. No dashboard do seu app, procure por **"WhatsApp"** na lista de produtos
2. Clique em **"Configurar"** ou **"Configurar WhatsApp"**
3. Siga o assistente de configuração
4. Aceite os termos (se aparecer)

**✅ Resultado:** WhatsApp estará configurado no seu app

---

### PASSO 4: Obter Phone Number ID

1. No dashboard do app, vá em **"WhatsApp"** → **"Configuração Inicial"** ou **"Getting Started"**
2. Você verá uma seção com **"Phone number ID"**
3. **Copie esse número** (ex: `123456789012345`)

**📝 Anote:** Phone Number ID = `___________________________`

---

### PASSO 5: Obter Access Token

1. Ainda na página de **"Configuração Inicial"**
2. Procure por **"Temporary access token"** ou **"Token de acesso temporário"**
3. Clique em **"Copiar"** ou **"Generate token"**
4. **Copie o token** (é uma string longa tipo: `EAAxxxxxxxxxxxx...`)

**⚠️ IMPORTANTE:**
- Token temporário dura **24 horas**
- Para produção, você precisará gerar um token permanente depois
- Por enquanto, use o temporário para testes

**📝 Anote:** Access Token = `___________________________`

---

### PASSO 6: Adicionar Número de Telefone

1. No dashboard, vá em **"WhatsApp"** → **"Números de telefone"** ou **"Phone Numbers"**
2. Clique em **"Adicionar número de telefone"** ou **"Add phone number"**
3. Escolha o país e digite o número
4. Escolha método de verificação: **SMS** ou **Ligação**
5. Digite o código recebido
6. Complete a verificação

**📝 Anote:** Número verificado = `___________________________`

---

### PASSO 7: Configurar no Sistema

1. Acesse seu sistema: `http://localhost:3000`
2. Faça login
3. Vá em **"Instâncias WhatsApp"**
4. Clique em **"Criar Instância"**
5. Dê um nome (ex: "WhatsApp Principal")
6. Clique em **"Configurar API"**
7. Preencha o formulário:

   - **Phone Number ID**: Cole o número que você copiou no Passo 4
   - **Access Token**: Cole o token que você copiou no Passo 5
   - **Número de Telefone**: Digite o número verificado (sem espaços, ex: 5511999999999)
   - **App ID**: (Opcional) Você encontra no dashboard do app
   - **Business Account ID**: (Opcional) Você encontra no dashboard
   - **Webhook Verify Token**: (Opcional) Deixe em branco para gerar automaticamente

8. **Copie a URL do Webhook** que aparece na tela
9. Clique em **"Salvar Configuração"**

**✅ Resultado:** Instância configurada no sistema

---

### PASSO 8: Configurar Webhook no Meta

1. No dashboard do Meta for Developers, vá em **"WhatsApp"** → **"Configuração"** → **"Webhooks"**
2. Clique em **"Configurar Webhooks"** ou **"Configure Webhooks"**
3. Preencha:
   - **URL do Callback**: Cole a URL que você copiou no Passo 7
     - Exemplo: `https://seu-dominio.com/api/whatsapp/webhook?instanceId=clx123...`
   - **Token de Verificação**: 
     - Volte ao sistema e veja o token gerado (ou use o que você preencheu)
     - Exemplo: `verify_clx123_1234567890`
4. Clique em **"Verificar e Salvar"**
5. Em **"Eventos de Assinatura"**, marque:
   - ✅ **messages** (mensagens)
   - ✅ **message_status** (status de mensagens) - opcional

6. Clique em **"Salvar"**

**✅ Resultado:** Webhook configurado e funcionando

---

## 📊 Resumo - O que você precisa informar ao sistema:

### Informações Obrigatórias:

1. **Phone Number ID** 
   - Onde encontrar: Meta for Developers → WhatsApp → Configuração Inicial
   - Exemplo: `123456789012345`

2. **Access Token**
   - Onde encontrar: Meta for Developers → WhatsApp → Configuração Inicial → Token
   - Exemplo: `EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - ⚠️ Token temporário dura 24h, depois precisa gerar novo ou permanente

3. **Número de Telefone** (opcional mas recomendado)
   - O número verificado no Meta
   - Formato: `5511999999999` (código do país + DDD + número)

### Informações Opcionais:

4. **App ID**
   - Onde encontrar: Dashboard do app → Configurações → Básico
   - Exemplo: `1234567890123456`

5. **Business Account ID**
   - Onde encontrar: Meta Business Manager → Configurações
   - Exemplo: `123456789012345`

6. **Webhook Verify Token**
   - Gerado automaticamente pelo sistema
   - Use o mesmo token ao configurar o webhook no Meta

---

## 🔗 Links Úteis

- **Meta Business**: https://business.facebook.com
- **Meta for Developers**: https://developers.facebook.com
- **Documentação WhatsApp Cloud API**: https://developers.facebook.com/docs/whatsapp/cloud-api
- **Guia de Início Rápido**: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started

---

## ⚠️ Importante para Desenvolvimento Local

Se você estiver testando localmente (`localhost`), o webhook não funcionará porque o Meta precisa de uma URL pública.

### Solução: Usar ngrok

1. Instale o ngrok: https://ngrok.com/download
2. Execute: `ngrok http 3000`
3. Copie a URL HTTPS que aparece (ex: `https://abc123.ngrok.io`)
4. Use essa URL no webhook:
   - `https://abc123.ngrok.io/api/whatsapp/webhook?instanceId=SEU_ID`

**⚠️ A URL do ngrok muda a cada vez que você reinicia!**

---

## ✅ Checklist Final

- [ ] Conta Meta Business criada
- [ ] App criado no Meta for Developers
- [ ] WhatsApp adicionado ao app
- [ ] Phone Number ID copiado
- [ ] Access Token copiado
- [ ] Número de telefone verificado
- [ ] Instância criada no sistema
- [ ] Configuração preenchida no sistema
- [ ] Webhook configurado no Meta
- [ ] Webhook verificado (deve mostrar "✓ Verificado")

---

## 🧪 Testando

1. Envie uma mensagem para o número configurado
2. A mensagem deve aparecer no sistema
3. Se tiver regras de automação, a resposta automática deve ser enviada

---

**Pronto! Siga esses passos e você terá tudo configurado!** 🚀



