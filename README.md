# AutoFlow - Automação WhatsApp

Sistema de automação de conversas para WhatsApp com Editor Visual de Fluxos, Next.js, TypeScript, Prisma e Neon.

## 🚀 Tecnologias

- **Next.js 14** - Framework React
- **TypeScript** - Tipagem estática
- **Prisma** - ORM para banco de dados
- **Neon** - PostgreSQL Serverless
- **Tailwind CSS** - Estilização
- **NextAuth.js** - Autenticação
- **WhatsApp Cloud API** - API oficial do WhatsApp
- **ReactFlow** - Editor visual de fluxos

## 📋 Pré-requisitos

- Node.js 18+ instalado
- Conta no Neon (PostgreSQL)
- Conta do WhatsApp para testes

## 🛠️ Instalação

1. Clone o repositório
2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

4. Edite o arquivo `.env` e adicione:
   - `DATABASE_URL` - URL de conexão do Neon
   - `NEXTAUTH_SECRET` - Gere uma chave secreta (use: `openssl rand -base64 32`)
   - `NEXTAUTH_URL` - URL da aplicação (http://localhost:3000 para desenvolvimento)

5. Configure o banco de dados:
```bash
npm run db:generate
npm run db:push
```

6. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

## 📱 Como usar

1. Acesse `http://localhost:3000`
2. Crie uma conta ou faça login
3. Conecte sua instância do WhatsApp
4. Configure regras de automação
5. O sistema responderá automaticamente às mensagens recebidas

## 🔐 Credenciais Necessárias

Para usar o sistema, você precisará fornecer:

1. **DATABASE_URL do Neon**: URL de conexão do seu banco PostgreSQL
2. **NEXTAUTH_SECRET**: Chave secreta para autenticação (pode gerar uma)

## 🚀 Deploy (Produção)

Veja o arquivo `GUIA_DEPLOY.md` para instruções completas de deploy na Vercel.

### Resumo Rápido:

1. Crie um repositório no GitHub
2. Faça push do código
3. Importe na Vercel
4. Configure as variáveis de ambiente
5. Deploy automático! 🎉

## ⚠️ Avisos Importantes

- Este projeto usa WhatsApp Cloud API oficial
- Use apenas para testes e desenvolvimento pessoal
- Para uso em produção com múltiplos clientes, verifique os limites da API
- Mensagens dentro da janela de 24h são gratuitas (tipo "Service")



