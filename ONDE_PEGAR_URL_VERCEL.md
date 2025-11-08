# 📍 Onde Pegar a URL Após o Deploy na Vercel

Após fazer o deploy, você terá uma URL HTTPS automática!

---

## 🎯 Onde Encontrar a URL

### Após o Deploy

1. **Na tela de "Deployments"** (ou na tela inicial do projeto):
   - Você verá algo como: `https://seu-projeto-abc123.vercel.app`
   - Essa é a sua URL de produção! ✅

2. **Ou no Dashboard do projeto:**
   - Clique no seu projeto
   - A URL aparece no topo ou em "Domains"

---

## 📋 Exemplo de URL

A URL será algo assim:
```
https://agente-ia-abc123.vercel.app
```

Ou se você escolher um nome customizado:
```
https://autozap.vercel.app
```

---

## ✅ O Que Fazer Com a URL

### 1. Configurar no Meta for Developers

1. Vá em **"Login do Facebook"** → **"Configurações"**
2. No campo **"URIs de redirecionamento do OAuth válidos"**, adicione:
   ```
   https://sua-url.vercel.app/api/whatsapp/facebook-callback
   ```
   (Substitua `sua-url.vercel.app` pela URL real que a Vercel te deu)
3. **Ative "Forçar HTTPS"** (mude para "Sim")
4. **Salve**

### 2. Configurar Variáveis na Vercel

1. No projeto na Vercel, vá em **Settings** → **Environment Variables**
2. Adicione/Atualize:
   ```env
   NEXTAUTH_URL=https://sua-url.vercel.app
   ```
   (Use a mesma URL que a Vercel te deu)

### 3. Testar no Validador

1. No Meta for Developers, no validador de URI
2. Cole: `https://sua-url.vercel.app/api/whatsapp/facebook-callback`
3. Clique em **"Verificar URI"**
4. Deve funcionar! ✅

---

## 🎯 Resumo

- **URL da Vercel:** Aparece após o deploy (ex: `https://seu-projeto.vercel.app`)
- **Adicione no Meta:** `https://sua-url.vercel.app/api/whatsapp/facebook-callback`
- **Configure NEXTAUTH_URL:** `https://sua-url.vercel.app`

---

Depois do deploy, me manda a URL que eu te ajudo a configurar! 🚀

