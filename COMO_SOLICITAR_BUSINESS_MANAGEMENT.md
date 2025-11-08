# 🔐 Como Solicitar Aprovação da Permissão business_management

A permissão `business_management` é necessária para acessar contas Meta Business, mas precisa ser **aprovada pela Meta**.

---

## 📋 Passo a Passo

### 1. Acesse Permissões e Recursos

1. No Meta for Developers, vá em seu app **"AutoZap"**
2. No menu lateral, procure por **"Permissões e recursos"** ou **"Permissions and Features"**
3. Clique

### 2. Encontre business_management

1. Procure por `business_management` na lista de permissões
2. Se não encontrar, clique em **"Adicionar permissão"** ou **"Add Permission"**
3. Digite `business_management` e adicione

### 3. Solicitar Aprovação

1. Clique em `business_management`
2. Procure por **"Solicitar"**, **"Request"** ou **"Submit for Review"**
3. Preencha o formulário:

   **Por que você precisa desta permissão?**
   ```
   Para acessar contas Meta Business e conectar WhatsApp Business via OAuth.
   O sistema precisa obter automaticamente Phone Number ID e Access Token 
   quando clientes autorizam via Facebook, sem precisar que eles configurem 
   manualmente as credenciais.
   ```

   **Como você usa esta permissão?**
   ```
   Quando um cliente autoriza via Facebook OAuth, o sistema usa 
   business_management para:
   1. Listar contas Meta Business do cliente
   2. Acessar WhatsApp Business Accounts vinculadas
   3. Obter Phone Number ID e Access Token automaticamente
   4. Conectar o WhatsApp Business sem configuração manual
   ```

   **URLs de uso:**
   - Adicione: `https://auto-zap-snsb.vercel.app`

4. Envie para revisão

---

## ⏳ Aguardar Aprovação

- Pode levar **alguns dias** para a Meta revisar
- Você receberá um email quando for aprovada
- Enquanto aguarda, pode testar em **modo de desenvolvimento**

---

## 🧪 Testar em Modo de Desenvolvimento

Mesmo sem aprovação, você pode testar:

1. Adicione usuários de teste no app
2. Use sua própria conta para testar
3. A permissão pode funcionar em modo de desenvolvimento

---

## ✅ Após Aprovação

1. A permissão estará disponível para todos os usuários
2. O fluxo OAuth funcionará completamente
3. Clientes poderão conectar seus WhatsApp Business

---

## 📝 Nota Importante

A permissão `business_management` pode mostrar um aviso de "Invalid Scope" durante o desenvolvimento, mas isso é normal. Após a aprovação, funcionará corretamente.

---

Vou adicionar `business_management` de volta no código agora! 🚀

