# 🔵 Guia: Conectar WhatsApp via Facebook OAuth

Este guia explica como usar o método de conexão via Facebook OAuth. O cliente autoriza via Facebook e você obtém as credenciais automaticamente, sem precisar que o cliente coloque cartão de crédito.

---

## 🎯 Como Funciona

**Fluxo de conexão via Facebook OAuth:**

1. ✅ Cliente clica em "Conectar com Facebook"
2. ✅ Cliente faz login no Facebook e autoriza o acesso
3. ✅ Sistema obtém automaticamente:
   - Phone Number ID
   - Access Token
   - Business Account ID
   - App ID
4. ✅ Conexão estabelecida automaticamente
5. ✅ Cliente não precisa colocar cartão de crédito
6. ✅ Você controla todos os custos

---

## 📋 Pré-requisitos

### Para Você (Dono do Sistema):

1. ✅ Criar um **App no Meta for Developers**
2. ✅ Configurar **Facebook Login** no app
3. ✅ Obter **App ID** e **App Secret**
4. ✅ Configurar **URLs de redirecionamento**
5. ✅ Solicitar permissões WhatsApp (pode precisar de revisão da Meta)

### Para o Cliente:

1. ✅ Ter uma conta **Meta Business** (gratuita)
2. ✅ Ter um **WhatsApp Business Account** configurado
3. ✅ Ter pelo menos um **número de telefone** verificado

---

## 🔧 Passo 1: Criar App no Meta for Developers

1. Acesse: https://developers.facebook.com/
2. Clique em **"Meus Apps"** → **"Criar App"**
3. Escolha o tipo: **"Negócios"**
4. Preencha:
   - Nome do app (ex: "AutoZap - Automação WhatsApp")
   - E-mail de contato
5. Clique em **"Criar app"**

---

## ⚙️ Passo 2: Configurar Facebook Login

1. No app criado, vá em **"Adicionar produto"**
2. Procure por **"Facebook Login"** e clique em **"Configurar"**
3. Vá em **"Configurações"** → **"Básico"**
4. Adicione as URLs:
   - **URLs de redirecionamento OAuth válidas:**
     - `http://localhost:3000/api/whatsapp/facebook-callback` (desenvolvimento)
     - `https://seu-dominio.com/api/whatsapp/facebook-callback` (produção)
5. Salve as alterações

---

## 🔑 Passo 3: Obter App ID e App Secret

1. No Meta for Developers, vá em **"Configurações"** → **"Básico"**
2. Copie o **"ID do aplicativo"** (App ID)
3. Copie o **"Chave secreta do aplicativo"** (App Secret)
4. **Importante:** Guarde o App Secret com segurança!

---

## 📝 Passo 4: Configurar Variáveis de Ambiente

Adicione no seu arquivo `.env`:

```env
FACEBOOK_CLIENT_ID=seu_app_id_aqui
FACEBOOK_CLIENT_SECRET=seu_app_secret_aqui
NEXTAUTH_URL=http://localhost:3000  # ou https://seu-dominio.com em produção
```

---

## 🔐 Passo 5: Solicitar Permissões WhatsApp

Para acessar as APIs do WhatsApp, você precisa solicitar permissões:

1. No Meta for Developers, vá em **"Permissões e recursos"**
2. Adicione as seguintes permissões:
   - `business_management`
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
   - `pages_read_engagement`
   - `pages_manage_metadata`

3. **Importante:** Algumas permissões podem precisar de **revisão da Meta**
4. Enquanto aguarda aprovação, pode usar em modo de desenvolvimento/teste

---

## 🚀 Passo 6: Usar no Sistema

### Para Você:

1. No sistema, vá em **"Instâncias WhatsApp"**
2. Crie uma nova instância (ex: "WhatsApp Cliente João")
3. Clique em **"🔵 Conectar via Facebook"**
4. O sistema gerará uma URL de autorização
5. **Compartilhe esta URL com o cliente** ou abra em uma nova janela

### Para o Cliente:

1. Cliente acessa a URL de autorização
2. Cliente faz login no Facebook
3. Cliente autoriza o acesso às permissões solicitadas
4. Sistema obtém automaticamente as credenciais
5. Conexão estabelecida!

---

## 💡 Vantagens deste Método

- ✅ **Mais simples para o cliente**: Só precisa autorizar via Facebook
- ✅ **Sem cartão de crédito**: Cliente não precisa colocar cartão
- ✅ **Automático**: Credenciais obtidas automaticamente
- ✅ **Seguro**: Usa OAuth oficial da Meta
- ✅ **Centralizado**: Você controla todos os custos

---

## 🚨 Problemas Comuns

### Erro "App ID não configurado":
- Verifique se `FACEBOOK_CLIENT_ID` está no `.env`
- Reinicie o servidor após adicionar variáveis de ambiente

### Erro "Permissões negadas":
- Cliente precisa autorizar todas as permissões
- Verifique se as permissões foram solicitadas no app

### Erro "Nenhuma conta de negócios encontrada":
- Cliente precisa ter uma conta Meta Business
- Cliente precisa ter WhatsApp Business configurado

### Erro "Nenhum número de telefone encontrado":
- Cliente precisa ter pelo menos um número verificado
- Número precisa estar ativo no WhatsApp Business

### Erro "URL de redirecionamento inválida":
- Verifique se a URL está configurada no Meta for Developers
- URL deve ser exatamente igual (com/sem barra final)

---

## 📚 Referências

- [Meta for Developers - Facebook Login](https://developers.facebook.com/docs/facebook-login)
- [Meta Business Platform - OAuth](https://developers.facebook.com/docs/business-platform)
- [WhatsApp Business API - Permissões](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)

---

## ✅ Pronto!

Agora você pode conectar números do WhatsApp via Facebook OAuth! 🎉

**Lembre-se:**
- Configure as variáveis de ambiente
- Adicione as URLs de redirecionamento
- Solicite as permissões necessárias
- Teste primeiro com sua própria conta

