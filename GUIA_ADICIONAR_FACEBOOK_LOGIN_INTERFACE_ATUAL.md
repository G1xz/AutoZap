# 🔧 Guia: Adicionar Facebook Login (Interface Atual da Meta)

Se você está vendo "Adicionar casos de uso" em vez de "Adicionar produto", siga este guia atualizado.

---

## 📋 Passo 1: Acessar seu App

1. Acesse: https://developers.facebook.com/
2. Faça login
3. Clique em **"Meus Apps"**
4. Selecione seu app do **AutoZap**

---

## 🔍 Passo 2: Encontrar Facebook Login

### Opção A: Via Menu Lateral

1. No menu lateral esquerdo, procure por **"Facebook Login"**
2. Se já estiver lá, clique nele
3. Se não estiver, continue para Opção B

### Opção B: Via Configurações

1. No menu lateral, vá em **"Configurações"** → **"Básico"**
2. Role a página até encontrar **"Produtos"** ou **"Products"**
3. Procure por **"Facebook Login"** na lista
4. Se não estiver, clique em **"Adicionar casos de uso"** ou **"Add Use Cases"**

### Opção C: Via Dashboard Principal

1. No dashboard do app, procure por uma seção de **"Produtos"** ou **"Products"**
2. Procure por **"Facebook Login"**
3. Se não estiver, pode estar em **"Recursos"** ou **"Features"**

---

## ⚙️ Passo 3: Adicionar Facebook Login

### Se aparecer "Adicionar casos de uso":

1. Clique em **"Adicionar casos de uso"**
2. Procure por **"Autenticação"** ou **"Authentication"**
3. Ou procure diretamente por **"Facebook Login"**
4. Selecione e adicione

### Se já tiver Facebook Login na lista:

1. Clique em **"Facebook Login"**
2. Vá para o Passo 4

### Se não encontrar em lugar nenhum:

1. Vá em **"Configurações"** → **"Avançado"**
2. Procure por **"Recursos"** ou **"Features"**
3. Ou tente acessar diretamente: `https://developers.facebook.com/apps/SEU_APP_ID/fb-login/`

---

## 🔗 Passo 4: Configurar URLs de Redirecionamento

Depois de encontrar/adicionar Facebook Login:

1. No menu lateral, vá em **"Facebook Login"** → **"Configurações"**
2. Ou vá em **"Facebook Login"** → **"Settings"**
3. Role até **"URLs de redirecionamento OAuth válidas"** ou **"Valid OAuth Redirect URIs"**
4. Adicione:

```
http://localhost:3000/api/whatsapp/facebook-callback
```

5. Se já tiver URLs, adicione esta na lista
6. Clique em **"Salvar alterações"** ou **"Save Changes"**

---

## 🔑 Passo 5: Obter App ID e App Secret

1. Vá em **"Configurações"** → **"Básico"**
2. Você verá:
   - **"ID do aplicativo"** (App ID) - copie este
   - **"Chave secreta do aplicativo"** (App Secret) - clique em "Mostrar" e copie

---

## 📝 Passo 6: Configurar Variáveis de Ambiente

No seu arquivo `.env`:

```env
FACEBOOK_CLIENT_ID=seu_app_id_aqui
FACEBOOK_CLIENT_SECRET=seu_app_secret_aqui
```

---

## 🔐 Passo 7: Adicionar Permissões WhatsApp

1. Vá em **"Permissões e recursos"** ou **"Permissions and Features"**
2. Clique em **"Adicionar permissão"** ou **"Add Permission"**
3. Adicione:
   - `business_management`
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
   - `pages_read_engagement`
   - `pages_manage_metadata`

---

## 🆘 Se Não Encontrar Facebook Login

### Alternativa 1: Acesso Direto

Tente acessar diretamente (substitua SEU_APP_ID pelo ID do seu app):

```
https://developers.facebook.com/apps/SEU_APP_ID/fb-login/
```

### Alternativa 2: Via API

Se a interface não permitir, você pode configurar via API da Meta (mais avançado).

### Alternativa 3: Verificar Tipo de App

Alguns tipos de app podem não suportar Facebook Login. Verifique se seu app é do tipo:
- ✅ **Negócios** (Business)
- ✅ **Outro** (Other)
- ❌ Alguns tipos específicos podem não ter

---

## 💡 Dica

Se a interface estiver muito diferente, pode ser:
- Nova interface da Meta (2024)
- Região diferente
- Tipo de app diferente

**Solução:** Tente procurar por termos como:
- "Login"
- "Authentication"
- "OAuth"
- "Facebook Login"
- "Produtos" / "Products"
- "Recursos" / "Features"

---

## 📸 Se Precisar de Ajuda Visual

Se quiser, me descreva o que você está vendo na tela do app e eu te ajudo a encontrar o caminho certo!

---

Pronto! Siga os passos acima e me avise se encontrar ou se precisar de mais ajuda! 🚀

