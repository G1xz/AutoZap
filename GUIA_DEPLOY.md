# 🚀 Guia de Deploy - AutoZap

Este guia mostra como fazer deploy do projeto na **Vercel** (recomendado para Next.js).

## 📋 Pré-requisitos

1. Conta no GitHub (gratuita)
2. Conta na Vercel (gratuita)
3. Conta no Neon (PostgreSQL - já tem)
4. Conta Meta Business (para WhatsApp Cloud API - já tem)

## 🎯 Passo a Passo

### 1. Preparar o Repositório Git

```bash
# Inicializar Git (se ainda não tiver)
git init

# Adicionar todos os arquivos
git add .

# Fazer commit inicial
git commit -m "Initial commit"
```

### 2. Criar Repositório no GitHub

1. Acesse https://github.com/new
2. Crie um novo repositório (ex: `autozap`)
3. **NÃO** inicialize com README (já temos um)
4. Siga as instruções mostradas:
```bash
git remote add origin https://github.com/SEU_USUARIO/autozap.git
git branch -M main
git push -u origin main
```

### 3. Fazer Deploy na Vercel

1. Acesse https://vercel.com e faça login com GitHub
2. Clique em "Add New Project"
3. Importe o repositório que você acabou de criar
4. Configure as variáveis de ambiente:

#### Variáveis de Ambiente na Vercel:

```
DATABASE_URL=sua_url_do_neon_aqui
NEXTAUTH_SECRET=cole_aqui_uma_chave_secreta_aleatoria
NEXTAUTH_URL=https://seu-projeto.vercel.app
```

**Como gerar NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```
Ou use este gerador online: https://generate-secret.vercel.app/32

5. Clique em "Deploy"

### 4. Configurar Banco de Dados

Após o deploy, ainda precisamos rodar as migrations do Prisma:

1. Na Vercel, vá em "Settings" > "Build & Development Settings"
2. Adicione um comando de build personalizado:
   ```bash
   npm install && npx prisma generate && npx prisma db push && npm run build
   ```

Ou execute manualmente via terminal da Vercel (Settings > Functions > Edge Functions):

```bash
npx prisma generate
npx prisma db push
```

### 5. Configurar WhatsApp Cloud API

1. Acesse seu projeto na Vercel e copie a URL (ex: `https://autozap.vercel.app`)
2. No Meta Business:
   - Configure o webhook com a URL: `https://autozap.vercel.app/api/whatsapp/webhook?instanceId=SEU_ID`
   - Use o mesmo token de verificação que configurou antes
3. Pronto! Agora não precisa mais do localtunnel 🎉

## 📝 Variáveis de Ambiente Necessárias

Crie um arquivo `.env.example` com estas variáveis (fora do Git):

```env
DATABASE_URL=postgresql://usuario:senha@host.neon.tech/dbname?sslmode=require
NEXTAUTH_SECRET=seu_secret_aqui
NEXTAUTH_URL=https://seu-projeto.vercel.app
```

## 🔄 Atualizações Futuras

Quando fizer alterações:

```bash
git add .
git commit -m "Sua mensagem"
git push
```

A Vercel faz deploy automático quando você faz push! 🚀

## 🆘 Problemas Comuns

### Erro de Build
- Verifique se todas as variáveis de ambiente estão configuradas
- Veja os logs em "Deployments" > "Logs"

### Erro de Banco de Dados
- Verifique se a `DATABASE_URL` está correta
- Certifique-se de rodar `npx prisma db push` após o deploy

### Webhook não funciona
- Verifique se a URL está correta na configuração do Meta
- Certifique-se de que o token de verificação está correto

## 💰 Custos

- **Vercel**: Gratuito para projetos pessoais (Hobby plan)
- **Neon**: Gratuito até 512MB de armazenamento
- **WhatsApp Cloud API**: Gratuito para mensagens dentro da janela de 24h

---

**Pronto para fazer deploy? Siga os passos acima!** 🎉


