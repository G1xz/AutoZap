# 🔑 Como Criar Token Permanente - WhatsApp Cloud API

## 🎯 Por que criar token permanente?

- ✅ Não expira (tokens temporários duram 24h)
- ✅ Mais fácil de testar
- ✅ Ideal para produção
- ✅ Não precisa ficar gerando novo token toda hora

---

## 📋 Passo a Passo

### 1. Acesse o Meta for Developers
- https://developers.facebook.com
- Vá no seu app → WhatsApp

### 2. Vá em "Configuração" → "Tokens"
- Ou diretamente: WhatsApp → Configuração → Tokens

### 3. Clique em "Gerar Token"
- Escolha o tipo: **"Token de Acesso do Sistema"** ou **"System User Token"**

### 4. Selecione Permissões
- Marque: **`whatsapp_business_messaging`**
- Marque: **`whatsapp_business_management`**
- Clique em "Gerar Token"

### 5. Copie o Token
- O token será algo como: `EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Copie e guarde com segurança** (não expira!)

### 6. Configure no Sistema
- No seu sistema, vá em "Reconfigurar" na instância
- Cole o token permanente no campo "Access Token"
- Salve

---

## ⚠️ Importante

- **Guarde o token com segurança** - não compartilhe
- **Tokens permanentes** são mais seguros, mas ainda devem ser protegidos
- Se precisar regenerar, pode fazer pelo Meta for Developers

---

## 🚀 Depois de Configurar

1. Atualize o token no sistema (Reconfigurar)
2. Teste enviando uma mensagem
3. O webhook deve funcionar normalmente

---

**Boa sorte amanhã! Quando criar o token permanente, é só atualizar no sistema e testar!** 🎉



