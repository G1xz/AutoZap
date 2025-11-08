# ✅ Configurar Facebook Login (Agora que Encontramos!)

Você encontrou o Facebook Login! Agora vamos configurar.

---

## 📋 Passo 1: Adicionar URL de Redirecionamento

1. No Facebook Login, vá em **"Configurações"** (Settings)
2. Procure por **"URLs de redirecionamento OAuth válidas"** ou **"Valid OAuth Redirect URIs"**
3. Adicione esta URL:

```
http://localhost:3000/api/whatsapp/facebook-callback
```

4. Clique em **"Salvar alterações"** ou **"Save Changes"**

**Importante:** 
- Se já tiver outras URLs, adicione esta na lista
- A URL deve ser exatamente assim (sem barra no final)

---

## 📋 Passo 2: Obter App Secret

1. Vá em **"Configurações"** → **"Básico"**
2. Procure por **"Chave secreta do aplicativo"** (App Secret)
3. Clique em **"Mostrar"** (pode pedir senha do Facebook)
4. **Copie o App Secret** - você só vê uma vez!
5. Guarde com segurança

---

## 🔑 Passo 3: Adicionar no .env

No seu arquivo `.env`, adicione:

```env
FACEBOOK_CLIENT_ID=2058451241567788
FACEBOOK_CLIENT_SECRET=cole_o_app_secret_aqui
```

---

## 🔐 Passo 4: Adicionar Permissões WhatsApp

1. No app, vá em **"Permissões e recursos"** ou **"Permissions and Features"**
2. Adicione as seguintes permissões:
   - `business_management`
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
   - `pages_read_engagement`
   - `pages_manage_metadata`

---

## ✅ Passo 5: Reiniciar Servidor

Após adicionar as variáveis no `.env`:

```bash
# Pare o servidor (Ctrl+C)
npm run dev
```

---

## 🧪 Passo 6: Testar

1. No sistema, crie uma instância
2. Clique em **"🔵 Conectar via Facebook"**
3. Teste a conexão!

---

Me avise quando terminar cada passo! 🚀

