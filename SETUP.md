# Guia de Configuração - WhatsApp Automation

## 📋 O que você precisa fornecer

Para que o sistema funcione, você precisa configurar as seguintes credenciais:

### 1. DATABASE_URL (Neon)

Você precisa criar um banco de dados PostgreSQL no Neon e fornecer a URL de conexão.

**Passos:**
1. Acesse [https://neon.tech](https://neon.tech)
2. Crie uma conta (se ainda não tiver)
3. Crie um novo projeto
4. Copie a connection string (DATABASE_URL)
5. A URL terá o formato: `postgresql://usuario:senha@host/database?sslmode=require`

**Exemplo:**
```
DATABASE_URL="postgresql://user:password@ep-example-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

### 2. NEXTAUTH_SECRET

Esta é uma chave secreta para criptografar as sessões de autenticação.

**Como gerar:**
- No Windows (PowerShell): 
  ```powershell
  [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
  ```
  
- No Linux/Mac:
  ```bash
  openssl rand -base64 32
  ```

**Exemplo:**
```
NEXTAUTH_SECRET="sua-chave-secreta-aqui-com-32-caracteres-ou-mais"
```

### 3. NEXTAUTH_URL

URL base da sua aplicação.

**Para desenvolvimento local:**
```
NEXTAUTH_URL="http://localhost:3000"
```

**Para produção:**
```
NEXTAUTH_URL="https://seu-dominio.com"
```

## 🔧 Passos para Configurar

### Passo 1: Instalar Dependências

```bash
npm install
```

### Passo 2: Criar Arquivo .env

Crie um arquivo `.env` na raiz do projeto com o seguinte conteúdo:

```env
DATABASE_URL="sua-database-url-do-neon"
NEXTAUTH_SECRET="sua-chave-secreta-gerada"
NEXTAUTH_URL="http://localhost:3000"
```

### Passo 3: Configurar Banco de Dados

```bash
# Gerar o cliente Prisma
npm run db:generate

# Criar as tabelas no banco
npm run db:push
```

### Passo 4: Iniciar o Servidor

```bash
npm run dev
```

O servidor estará rodando em `http://localhost:3000`

## 📱 Como Usar

1. **Criar Conta**: Acesse `http://localhost:3000` e crie uma conta
2. **Criar Instância WhatsApp**: No dashboard, crie uma nova instância do WhatsApp
3. **Escanear QR Code**: Escaneie o QR code exibido com seu WhatsApp
4. **Configurar Regras**: Crie regras de automação para responder mensagens automaticamente

## ⚠️ Importante

- O WhatsApp precisa estar conectado ao WhatsApp Web (não pode usar outro dispositivo)
- Mantenha o servidor rodando para que as automações funcionem
- Use apenas para testes pessoais inicialmente
- Para produção, considere usar a WhatsApp Business API oficial

## 🐛 Resolução de Problemas

### Erro ao conectar WhatsApp
- Certifique-se de que não há outra sessão do WhatsApp Web aberta
- Desconecte todas as sessões do WhatsApp Web antes de conectar
- Limpe o cache do navegador se necessário

### Erro de banco de dados
- Verifique se a DATABASE_URL está correta
- Certifique-se de que o banco Neon está acessível
- Execute `npm run db:push` novamente

### QR Code não aparece
- Aguarde alguns segundos após criar a instância
- Recarregue a página
- Verifique os logs do servidor para erros



