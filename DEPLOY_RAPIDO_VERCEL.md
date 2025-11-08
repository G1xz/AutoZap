# 🚀 Deploy Rápido na Vercel

Vamos fazer deploy para ter uma URL HTTPS real e configurar o Facebook OAuth!

---

## 📋 Passo 1: Preparar o Código

1. **Commit e push para GitHub** (se ainda não fez):
   ```bash
   git add .
   git commit -m "Preparar para deploy"
   git push
   ```

---

## 📋 Passo 2: Deploy na Vercel

1. Acesse: https://vercel.com
2. Faça login (pode usar GitHub)
3. Clique em **"Add New Project"** ou **"Import Project"**
4. Conecte seu repositório do GitHub
5. Configure:
   - **Framework Preset:** Next.js (deve detectar automaticamente)
   - **Root Directory:** `./` (raiz)
6. Clique em **"Deploy"**

---

## 📋 Passo 3: Configurar Variáveis de Ambiente na Vercel

Após o deploy, vá em **Settings** → **Environment Variables** e adicione:

```env
DATABASE_URL=sua_url_do_banco
NEXTAUTH_SECRET=sua_chave_secreta
NEXTAUTH_URL=https://seu-projeto.vercel.app
FACEBOOK_CLIENT_ID=2058451241567788
FACEBOOK_CLIENT_SECRET=seu_app_secret
```

**Importante:** 
- `NEXTAUTH_URL` deve ser a URL que a Vercel te deu (ex: `https://seu-projeto.vercel.app`)
- Não coloque barra no final!

---

## 📋 Passo 4: Configurar Facebook OAuth com URL de Produção

1. No Meta for Developers, vá em **"Login do Facebook"** → **"Configurações"**
2. No campo **"URIs de redirecionamento do OAuth válidos"**, adicione:
   ```
   https://seu-projeto.vercel.app/api/whatsapp/facebook-callback
   ```
   (Substitua `seu-projeto` pelo nome real do seu projeto na Vercel)
3. **Ative "Forçar HTTPS"** (mude para "Sim")
4. Clique em **"Salvar alterações"**
5. Teste no validador - deve funcionar! ✅

---

## 📋 Passo 5: Atualizar Variáveis e Redeploy

1. Após adicionar as variáveis na Vercel, vá em **Deployments**
2. Clique nos **3 pontinhos** do último deploy
3. Clique em **"Redeploy"**
4. Aguarde o deploy terminar

---

## ✅ Pronto!

Agora você tem:
- ✅ URL HTTPS real (ex: `https://seu-projeto.vercel.app`)
- ✅ Facebook OAuth configurado
- ✅ Sistema funcionando em produção

---

## 🎯 Próximos Passos

1. Teste a conexão via Facebook no sistema
2. Se precisar de domínio customizado, configure na Vercel depois

---

Vamos fazer o deploy! 🚀

