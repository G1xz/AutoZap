# 🏢 Configurar Conta Central Fixa para Testes

Este guia mostra como configurar uma conta Meta Business central como "mãe" de tudo, com configurações fixas para facilitar os testes.

---

## 🎯 Objetivo

Configurar uma conta central com:
- ✅ **Token permanente** (não expira)
- ✅ **Mesmo App ID** para todos
- ✅ **Mesma Business Account** para todos
- ✅ **Configurações fixas** (não precisa ficar trocando)
- ✅ **Fácil de testar** (tudo centralizado)

---

## 📋 Passo 1: Gerar Token Permanente (Uma Vez Só)

### 1.1 Via Meta Business Suite (Recomendado)

1. Acesse: https://business.facebook.com/
2. Vá em **"Configurações"** → **"Usuários"** → **"Usuários do sistema"**
3. Clique em **"Adicionar"** (ou **"Add"**)
4. Preencha:
   - **Nome**: "AutoZap Sistema" (ou qualquer nome)
   - **Função**: **"Administrador"**
5. Clique em **"Criar usuário do sistema"**
6. Selecione o usuário criado
7. Clique em **"Atribuir ativos"**
8. Selecione:
   - **"Aplicativos"** → Selecione seu app "AutoZap"
   - **"Controle total"**
9. Salve
10. Ainda na página do usuário, clique em **"Gerar novo token"**
11. Configure:
    - **App**: Selecione "AutoZap"
    - **Expiração**: **"Nunca"** (Never)
    - **Permissões**: Marque:
      - ✅ `whatsapp_business_management`
      - ✅ `whatsapp_business_messaging`
12. Clique em **"Gerar token"**
13. **COPIE O TOKEN** - você só vê uma vez!
14. **GUARDE COM SEGURANÇA** - este é seu token permanente

---

## 📋 Passo 2: Obter IDs Fixos (Uma Vez Só)

### 2.1 App ID

1. Acesse: https://developers.facebook.com/
2. Abra seu app **AutoZap**
3. Vá em **"Configurações"** → **"Básico"**
4. Copie o **"ID do aplicativo"** (App ID)
   - Exemplo: `2058451241567788`
   - **Este é o mesmo para todos os números!**

### 2.2 Business Account ID

1. Ainda no Meta for Developers, vá em **"WhatsApp"** → **"Configuração Inicial"**
2. Ou acesse: https://business.facebook.com/
3. Vá em **"Configurações"** → **"Informações da empresa"**
4. Copie o **"ID da conta de negócios"** (Business Account ID)
   - Exemplo: `898944883296416`
   - **Este é o mesmo para todos os números!**

### 2.3 Phone Number ID (Para cada número)

Cada número tem seu próprio Phone Number ID, mas você obtém da mesma forma:

1. Acesse: https://business.facebook.com/
2. Vá em **"Gerenciador do WhatsApp"** → **"Telefones"**
3. Clique no número que você quer usar
4. Vá em **"Configurações"** → **"Número de telefone"**
5. Copie o **"ID do número de telefone"** (Phone Number ID)
   - Exemplo: `123456789012345`
   - **Cada número tem um ID diferente!**

---

## 📋 Passo 3: Configurar no Sistema (Configuração Fixa)

### 3.1 Variáveis de Ambiente (.env)

Adicione no seu `.env` (uma vez só):

```env
# Configurações Fixas da Conta Central
META_APP_ID=2058451241567788
META_ACCESS_TOKEN=seu_token_permanente_aqui
META_BUSINESS_ACCOUNT_ID=898944883296416

# Facebook OAuth (para conectar novos números)
FACEBOOK_CLIENT_ID=2058451241567788
FACEBOOK_CLIENT_SECRET=seu_app_secret_aqui

# NextAuth
NEXTAUTH_URL=https://auto-zap-snsb.vercel.app
NEXTAUTH_SECRET=sua_chave_secreta_aqui

# Database
DATABASE_URL=sua_url_do_banco_aqui
```

**Importante:**
- ✅ `META_APP_ID` - **Mesmo para todos** os números
- ✅ `META_ACCESS_TOKEN` - **Mesmo para todos** os números (token permanente)
- ✅ `META_BUSINESS_ACCOUNT_ID` - **Mesmo para todos** os números
- ⚠️ `Phone Number ID` - **Diferente para cada número** (você configura por instância)

---

## 📋 Passo 4: Usar Configurações Fixas no Código

### 4.1 Criar arquivo de configuração

Crie `lib/meta-config.ts`:

```typescript
export const metaConfig = {
  appId: process.env.META_APP_ID || '',
  accessToken: process.env.META_ACCESS_TOKEN || '',
  businessAccountId: process.env.META_BUSINESS_ACCOUNT_ID || '',
}

export function getMetaConfig() {
  if (!metaConfig.appId || !metaConfig.accessToken) {
    throw new Error('Meta config não encontrada. Verifique as variáveis de ambiente.')
  }
  return metaConfig
}
```

### 4.2 Usar nas instâncias

Quando criar uma nova instância, use:

```typescript
// Phone Number ID é específico de cada número
const phoneNumberId = '123456789012345' // Obter do Meta Business

// Mas App ID, Access Token e Business Account ID são fixos
const instance = {
  phoneId: phoneNumberId,
  accessToken: metaConfig.accessToken, // Fixo!
  appId: metaConfig.appId, // Fixo!
  businessAccountId: metaConfig.businessAccountId, // Fixo!
}
```

---

## 📋 Passo 5: Adicionar Novos Números (Processo Rápido)

Para adicionar um novo número de cliente:

### Opção A: Via Meta Business (Manual)

1. Acesse: https://business.facebook.com/
2. Vá em **"Gerenciador do WhatsApp"** → **"Telefones"**
3. Clique em **"Adicionar telefone"**
4. Digite o número do cliente
5. Verifique com código SMS
6. Obtenha o **Phone Number ID** do novo número
7. No sistema, crie nova instância com:
   - **Phone Number ID**: (novo, específico do número)
   - **Access Token**: (mesmo, fixo)
   - **App ID**: (mesmo, fixo)
   - **Business Account ID**: (mesmo, fixo)

### Opção B: Via Facebook OAuth (Automático)

1. No sistema, crie nova instância
2. Clique em **"Conectar via Facebook"**
3. Cliente autoriza via Facebook
4. Sistema obtém automaticamente:
   - Phone Number ID ✅
   - Access Token ✅ (já é o mesmo)
   - App ID ✅ (já é o mesmo)
   - Business Account ID ✅ (já é o mesmo)

---

## ✅ Vantagens desta Configuração

### 1. Configuração Fixa
- ✅ Token permanente (não expira)
- ✅ Mesmo App ID para todos
- ✅ Mesma Business Account para todos
- ✅ Não precisa ficar trocando configurações

### 2. Fácil de Testar
- ✅ Adiciona número → Obtém Phone Number ID → Configura
- ✅ Tudo centralizado na sua conta
- ✅ Você controla tudo

### 3. Fácil de Gerenciar
- ✅ Um token para todos os números
- ✅ Um App ID para todos
- ✅ Uma Business Account para todos
- ✅ Só muda o Phone Number ID por número

---

## 🔄 Fluxo Completo para Novo Cliente

1. **Cliente fornece número** de telefone
2. **Você adiciona** na sua conta Meta Business (ou cliente autoriza via OAuth)
3. **Você obtém** Phone Number ID do número
4. **Você cria** instância no sistema com:
   - Phone Number ID (novo)
   - Access Token (fixo, já configurado)
   - App ID (fixo, já configurado)
   - Business Account ID (fixo, já configurado)
5. **Pronto!** Cliente pode usar

---

## 📊 Resumo das Configurações

| Configuração | Tipo | Onde Obter |
|--------------|------|------------|
| **App ID** | Fixo (mesmo para todos) | Meta for Developers → Configurações → Básico |
| **Access Token** | Fixo (mesmo para todos) | Meta Business → Usuários do sistema → Gerar token |
| **Business Account ID** | Fixo (mesmo para todos) | Meta Business → Configurações → Informações da empresa |
| **Phone Number ID** | Variável (diferente por número) | Meta Business → Gerenciador do WhatsApp → Telefones |

---

## 🎯 Próximos Passos

1. ✅ Gerar token permanente (Passo 1)
2. ✅ Obter IDs fixos (Passo 2)
3. ✅ Configurar no `.env` (Passo 3)
4. ✅ Testar com um número
5. ✅ Adicionar mais números conforme necessário

---

## 💡 Dica

**Guarde estas informações em um lugar seguro:**
- Token permanente (só vê uma vez!)
- App ID
- Business Account ID

Você vai usar essas mesmas informações para todos os números que adicionar!

---

Pronto! Agora você tem uma configuração fixa e centralizada! 🚀

