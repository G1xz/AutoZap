# 🔧 Guia: Adicionar Facebook Login (Interface 2024 da Meta)

A interface do Meta for Developers mudou! Agora aparece "Adicionar casos de uso" em vez de "Adicionar produto". Siga este guia atualizado.

---

## 📋 Passo 1: Acessar seu App

1. Acesse: https://developers.facebook.com/
2. Faça login
3. Clique em **"Meus Apps"**
4. Selecione seu app do **AutoZap**

---

## 🔍 Passo 2: Encontrar Facebook Login

### Método 1: Via Menu Lateral (Mais Direto)

1. No menu lateral esquerdo, procure diretamente por **"Facebook Login"**
2. Se aparecer, clique nele
3. Se não aparecer, continue para Método 2

### Método 2: Via Configurações

1. No menu lateral, vá em **"Configurações"** → **"Básico"**
2. Role a página até encontrar uma seção de **"Produtos"** ou lista de produtos
3. Procure se **"Facebook Login"** já está na lista
4. Se estiver, clique nele

### Método 3: Acesso Direto (Mais Rápido)

1. Copie o **App ID** do seu app (está em Configurações → Básico)
2. Acesse diretamente esta URL (substitua SEU_APP_ID):

```
https://developers.facebook.com/apps/SEU_APP_ID/fb-login/
```

3. Isso deve abrir a configuração do Facebook Login diretamente

---

## ⚙️ Passo 3: Se Facebook Login Já Estiver Adicionado

Se você conseguir acessar Facebook Login (por qualquer método acima):

1. Vá em **"Configurações"** ou **"Settings"**
2. Procure por **"URLs de redirecionamento OAuth válidas"** ou **"Valid OAuth Redirect URIs"**
3. Adicione:

```
http://localhost:3000/api/whatsapp/facebook-callback
```

4. Clique em **"Salvar alterações"**

---

## 🔧 Passo 4: Se Facebook Login NÃO Estiver Adicionado

### Opção A: Via "Adicionar casos de uso"

1. Clique em **"Adicionar casos de uso"**
2. Procure por casos de uso relacionados a:
   - **"Autenticação"** ou **"Authentication"**
   - **"Login"**
   - **"OAuth"**
3. Selecione o caso de uso que inclui Facebook Login
4. Siga as instruções para configurar

### Opção B: Adicionar Manualmente via URL

1. Pegue seu **App ID** (Configurações → Básico)
2. Acesse:

```
https://developers.facebook.com/apps/SEU_APP_ID/fb-login/settings/
```

3. Isso deve abrir a configuração do Facebook Login
4. Se pedir para adicionar, adicione

### Opção C: Verificar se já está ativo

Alguns apps já têm Facebook Login ativo por padrão. Verifique:
1. Vá em **"Configurações"** → **"Básico"**
2. Role até **"Produtos"** ou **"Products"**
3. Veja se Facebook Login aparece na lista

---

## 🔑 Passo 5: Obter Credenciais

1. Vá em **"Configurações"** → **"Básico"**
2. Copie:
   - **"ID do aplicativo"** (App ID)
   - **"Chave secreta do aplicativo"** (App Secret) - clique em "Mostrar"

---

## 📝 Passo 6: Configurar no Sistema

No seu arquivo `.env`:

```env
FACEBOOK_CLIENT_ID=seu_app_id_aqui
FACEBOOK_CLIENT_SECRET=seu_app_secret_aqui
```

---

## 🆘 Se Ainda Não Encontrar

**Me diga:**
1. O que aparece no menu lateral do seu app?
2. Quais opções você vê quando clica em "Adicionar casos de uso"?
3. Qual é o App ID do seu app? (posso gerar o link direto)

Com essas informações, consigo te guiar exatamente onde clicar! 🎯

---

## 💡 Dica Rápida

**Tente acessar diretamente:**
1. Pegue o App ID do seu app
2. Acesse: `https://developers.facebook.com/apps/SEU_APP_ID/fb-login/`
3. Isso deve abrir Facebook Login direto!

Me avise o que você encontrou! 🚀

