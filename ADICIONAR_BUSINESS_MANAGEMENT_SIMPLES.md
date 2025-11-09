# 🔐 Adicionar business_management (Sem "Funções")

Se não tem "Funções" no menu, você já é administrador (criou o app). Vamos focar no essencial!

---

## ✅ Passo 1: Adicionar business_management nas Permissões

1. Acesse: https://developers.facebook.com/
2. Abra seu app **AutoZap**
3. No menu lateral, procure por:
   - **"Permissões e recursos"** ou
   - **"Permissions and Features"** ou
   - **"Permissões"** ou
   - **"Permissions"**
4. Clique

---

## ✅ Passo 2: Adicionar a Permissão

1. Na página de permissões, procure por:
   - **"Adicionar permissão"** ou
   - **"Add Permission"** ou
   - Um botão **"+"** ou
   - Um campo de busca

2. Digite: `business_management`

3. Se aparecer na lista, clique para adicionar

4. Se não aparecer:
   - Pode ser que precise solicitar diretamente
   - Continue para o Passo 3

---

## ✅ Passo 3: Solicitar Aprovação

1. Depois de adicionar `business_management`, procure por:
   - **"Solicitar"** ou
   - **"Request"** ou
   - **"Submit for Review"** ou
   - **"Enviar para revisão"**

2. Clique e preencha o formulário:

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
   - `https://auto-zap-snsb.vercel.app`

3. Envie para revisão

---

## ⚠️ Se Não Conseguir Adicionar

Se não conseguir adicionar `business_management`:

1. **Tente usar sem ela primeiro:**
   - O sistema já tem métodos alternativos
   - Teste a conexão novamente
   - Pode funcionar sem `business_management`

2. **Verifique se o app está em modo Business:**
   - Vá em **"Configurações"** → **"Básico"**
   - Verifique se o tipo é **"Negócios"** (Business)
   - Se for "Consumidor", pode ter limitações

3. **Verifique o modo do app:**
   - Deve estar em **"Desenvolvimento"** (Development Mode)
   - Não precisa estar publicado

---

## 🧪 Testar Agora (Sem business_management)

Mesmo sem `business_management`, você pode testar:

1. Aguarde o redeploy da Vercel terminar
2. Acesse: https://auto-zap-snsb.vercel.app/dashboard
3. Tente conectar via Facebook
4. O sistema tentará métodos alternativos

**Se funcionar:** Ótimo! Pode usar assim mesmo.

**Se não funcionar:** Aí sim precisa solicitar `business_management`.

---

## 📋 Resumo

1. ✅ **Tente adicionar** `business_management` em "Permissões e recursos"
2. ✅ **Solicite aprovação** se conseguir adicionar
3. ✅ **Teste sem ela** primeiro (pode funcionar!)
4. ⚠️ **Se não funcionar**, aí sim precisa aguardar aprovação

**Comece testando!** Pode funcionar sem `business_management`! 🚀

