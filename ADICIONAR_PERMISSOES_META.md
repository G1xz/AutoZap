# 🔐 Adicionar Permissões WhatsApp no Meta for Developers

As permissões podem precisar ser adicionadas primeiro no Meta for Developers antes de poder solicitá-las via OAuth.

---

## 📋 Passo a Passo

### 1. Acesse Permissões e Recursos

1. No Meta for Developers, vá em seu app **"AutoZap"**
2. No menu lateral, procure por **"Permissões e recursos"** ou **"Permissions and Features"**
3. Clique

### 2. Adicionar Permissões WhatsApp

1. Procure por **"Adicionar permissão"** ou **"Add Permission"**
2. Adicione estas permissões:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`

### 3. Verificar Status

- Algumas permissões podem precisar de **revisão da Meta**
- Para **testes**, você pode usar em modo de desenvolvimento
- Permissões básicas geralmente funcionam imediatamente

---

## ⚠️ Importante

Se mesmo assim não funcionar, pode ser que:

1. **O app precisa estar em modo específico** (Business, não Consumer)
2. **As permissões precisam ser aprovadas primeiro** pela Meta
3. **O método de OAuth precisa ser diferente** para WhatsApp Business

---

## 🧪 Teste Novamente

Após adicionar as permissões:

1. Aguarde o deploy da Vercel terminar
2. Teste novamente a conexão
3. Se ainda não funcionar, pode precisar usar outro método

---

Vá em **"Permissões e recursos"** e adicione as permissões! 🔐

