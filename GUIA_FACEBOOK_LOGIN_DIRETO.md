# 🎯 Guia Rápido: Acessar Facebook Login Diretamente

Como a interface mudou e não aparece "Facebook Login" nos casos de uso, vamos acessar diretamente!

---

## 🚀 Método Mais Rápido: URL Direta

### Passo 1: Pegar o App ID

1. No seu app, vá em **"Configurações"** → **"Básico"**
2. Copie o **"ID do aplicativo"** (App ID)
3. É um número longo (ex: `123456789012345`)

### Passo 2: Acessar Facebook Login Diretamente

Substitua `SEU_APP_ID` pelo ID que você copiou e acesse:

```
https://developers.facebook.com/apps/SEU_APP_ID/fb-login/
```

**Exemplo:** Se seu App ID for `123456789012345`, acesse:
```
https://developers.facebook.com/apps/123456789012345/fb-login/
```

### Passo 3: Configurar

1. Se pedir para adicionar Facebook Login, adicione
2. Vá em **"Configurações"** (Settings)
3. Adicione a URL de redirecionamento:
   ```
   http://localhost:3000/api/whatsapp/facebook-callback
   ```
4. Salve

---

## 🔍 Método Alternativo: Procurar no Menu Lateral

1. No menu lateral esquerdo do seu app, procure por:
   - **"Facebook Login"**
   - **"Login"**
   - **"Autenticação"**
   - **"OAuth"**

2. Se encontrar, clique e configure

---

## 📱 Método Alternativo: Via WhatsApp

Se seu app já tem WhatsApp configurado:

1. Vá em **"WhatsApp"** no menu lateral
2. Procure por opções de **"Autenticação"** ou **"Login"**
3. Ou tente acessar diretamente:
   ```
   https://developers.facebook.com/apps/SEU_APP_ID/whatsapp/
   ```

---

## 💡 Dica

**O mais fácil é usar a URL direta!** 

Me passe o App ID do seu app e eu te dou o link exato para acessar! 🎯

