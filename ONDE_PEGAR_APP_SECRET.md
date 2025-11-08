# 🔑 Onde Pegar o FACEBOOK_CLIENT_SECRET (App Secret)

O App Secret é a "Chave secreta do aplicativo" no Meta for Developers.

---

## 📍 Passo a Passo

### 1. Acesse o Meta for Developers

1. Vá em: https://developers.facebook.com/
2. Faça login
3. Clique no seu app **"AutoZap"**

### 2. Vá em Configurações → Básico

1. No menu lateral esquerdo, clique em **"Configurações"** (Settings)
2. Clique em **"Básico"** (Basic)

### 3. Encontre "Chave secreta do aplicativo"

1. Na página "Básico", role até encontrar **"Chave secreta do aplicativo"** (App Secret)
2. Você verá algo como: `Chave secreta do aplicativo: •••••••••••••••••`
3. Clique no botão **"Mostrar"** (Show) ao lado

### 4. Copie o App Secret

1. Pode pedir sua senha do Facebook (segurança)
2. Digite sua senha
3. O App Secret aparecerá
4. **COPIE IMEDIATAMENTE** - você só vê uma vez!
5. Cole no `.env` e na Vercel

---

## ⚠️ Importante

- **Você só vê o App Secret uma vez!**
- Se perder, precisa gerar um novo
- Guarde com segurança
- Não compartilhe publicamente

---

## 📝 Onde Adicionar

### No .env local:
```env
FACEBOOK_CLIENT_SECRET=cole_o_app_secret_aqui
```

### Na Vercel:
1. Settings → Environment Variables
2. Adicione: `FACEBOOK_CLIENT_SECRET`
3. Valor: cole o App Secret copiado
4. Salve

---

Vá em **Configurações → Básico** e procure por **"Chave secreta do aplicativo"**! 🔑

