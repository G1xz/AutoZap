# 📋 Guia para Clientes Finais: Como Conectar seu WhatsApp

Este guia é para seus **clientes finais** que vão usar o sistema de automação. Você pode compartilhar este guia com eles.

---

## 🎯 O que seu cliente precisa fazer

Para usar o sistema de automação, seu cliente precisa:

1. ✅ Ter uma conta **Meta Business** (gratuita)
2. ✅ Criar um **app** no Meta for Developers
3. ✅ Configurar **WhatsApp** no app
4. ✅ Obter **Phone Number ID** e **Access Token**
5. ✅ Fornecer essas informações para você
6. ✅ Configurar o **webhook** na Meta

---

## 📝 Passo a Passo para o Cliente

### Passo 1: Criar Conta Meta Business

1. Acesse: https://business.facebook.com/
2. Clique em **"Criar conta"** ou faça login
3. Preencha os dados da empresa
4. Verifique o e-mail

### Passo 2: Criar App no Meta for Developers

1. Acesse: https://developers.facebook.com/
2. Clique em **"Meus Apps"** → **"Criar App"**
3. Escolha o tipo: **"Negócios"** ou **"Outro"**
4. Preencha:
   - Nome do app (ex: "Automação WhatsApp - Minha Empresa")
   - E-mail de contato
5. Clique em **"Criar app"**

### Passo 3: Adicionar WhatsApp ao App

1. No app criado, vá em **"Adicionar produto"**
2. Procure por **"WhatsApp"** e clique em **"Configurar"**
3. Siga as instruções iniciais

### Passo 4: Obter Phone Number ID

1. No app, vá em **"WhatsApp"** → **"Configuração Inicial"**
2. Role até a seção **"ID do número de telefone"**
3. Você verá um número longo (ex: `123456789012345`)
4. **Copie este ID** - você precisará fornecer para o administrador do sistema

### Passo 5: Obter Access Token Permanente

1. Na mesma página, role até **"Token de acesso"**
2. Clique em **"Gerar token"** ou **"Renovar token"**
3. Selecione sua **Meta Business Account**
4. Selecione sua **WhatsApp Business Account**
5. Clique em **"Gerar token"**
6. **Copie o token** (ele só aparece uma vez!)
7. **Forneça este token para o administrador do sistema**

### Passo 6: Obter App ID (Opcional mas Recomendado)

1. No Meta for Developers, vá em **"Configurações"** → **"Básico"**
2. Copie o **"ID do aplicativo"** (App ID)
3. Forneça para o administrador do sistema

### Passo 7: Obter Business Account ID (Opcional)

1. Acesse: https://business.facebook.com/
2. Vá em **"Configurações"** → **"Contas"**
3. Copie o **"ID da conta comercial"** (Business Account ID)
4. Forneça para o administrador do sistema

### Passo 8: Fornecer Informações

Envie para o administrador do sistema:

- ✅ **Phone Number ID**
- ✅ **Access Token** (permanente)
- ✅ **App ID** (opcional)
- ✅ **Business Account ID** (opcional)
- ✅ **Número de telefone** (formato: 5511999999999)

### Passo 9: Configurar Webhook (Após o administrador configurar)

1. O administrador do sistema te fornecerá:
   - URL do webhook (ex: `https://seu-sistema.com/api/whatsapp/webhook?instanceId=xxx`)
   - Token de verificação do webhook

2. No Meta for Developers, vá em **"WhatsApp"** → **"Configuração"**
3. Role até **"Webhooks"**
4. Clique em **"Configurar webhooks"** ou **"Editar"**
5. Cole a **URL do webhook** fornecida
6. Cole o **Token de verificação** fornecido
7. Marque os eventos:
   - ✅ **messages** (mensagens recebidas)
   - ✅ **messaging_postbacks** (respostas de botões)
8. Clique em **"Verificar e salvar"**

---

## ✅ Pronto!

Após seguir todos os passos:

1. ✅ O administrador do sistema configurou sua instância
2. ✅ O webhook está configurado na Meta
3. ✅ Seu número está conectado ao sistema
4. ✅ As automações estão ativas

---

## 🚨 Importante

- ⚠️ **Nunca compartilhe seu Access Token** publicamente
- ⚠️ **Guarde suas credenciais** em local seguro
- ⚠️ Se o token expirar, gere um novo e forneça ao administrador
- ✅ Use **tokens permanentes** (não temporários de 24h)

---

## 📞 Precisa de Ajuda?

Se tiver dúvidas durante o processo, entre em contato com o administrador do sistema.

---

## 📚 Links Úteis

- [Meta Business Suite](https://business.facebook.com/)
- [Meta for Developers](https://developers.facebook.com/)
- [Documentação WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)

