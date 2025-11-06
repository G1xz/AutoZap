# 🚀 Deploy Rápido - AutoZap

## Passo a Passo Simplificado

### 1️⃣ Criar Repositório no GitHub

```bash
# No terminal do projeto
git init
git add .
git commit -m "Initial commit"
```

Depois:
1. Vá em https://github.com/new
2. Crie um repositório (ex: `autozap`)
3. **NÃO** marque "Initialize with README"
4. Execute:
```bash
git remote add origin https://github.com/SEU_USUARIO/autozap.git
git branch -M main
git push -u origin main
```

### 2️⃣ Deploy na Vercel

1. Acesse https://vercel.com
2. Faça login com GitHub
3. Clique em "Add New Project"
4. Importe seu repositório
5. Configure estas variáveis de ambiente:

```
DATABASE_URL=sua_url_do_neon
NEXTAUTH_SECRET=use_openssl_rand_base64_32
NEXTAUTH_URL=https://seu-projeto.vercel.app
```

6. Clique "Deploy"
7. Aguarde o build terminar

### 3️⃣ Configurar Banco (Primeira Vez)

Após o deploy, execute localmente:

```bash
npm i -g vercel
vercel link
vercel env pull .env.local
npx prisma db push
```

### 4️⃣ Configurar Webhook

1. Copie a URL do projeto Vercel (ex: `https://autozap.vercel.app`)
2. No Meta Business, configure:
   - URL: `https://autozap.vercel.app/api/whatsapp/webhook?instanceId=SEU_ID`
   - Token: o mesmo que você configurou antes

### 5️⃣ Pronto! 🎉

Agora você tem:
- ✅ URL pública permanente
- ✅ Deploy automático a cada push
- ✅ Sem localtunnel necessário

---

**Dúvidas? Veja o arquivo `GUIA_DEPLOY.md` completo!**

