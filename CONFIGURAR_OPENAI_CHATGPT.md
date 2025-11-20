# 🤖 Configurar OpenAI (ChatGPT) para Fluxos com IA

Este guia explica como configurar a integração com OpenAI para usar ChatGPT nos fluxos de automação.

---

## ✅ O que foi implementado

- ✅ **Biblioteca de integração com OpenAI** (`lib/openai.ts`)
- ✅ **Nó de IA funcional** no editor de workflows
- ✅ **Execução automática** de respostas de IA nos fluxos
- ✅ **Separação visual** entre fluxos manuais e fluxos com IA
- ✅ **Suporte a contexto** de conversa para respostas mais inteligentes
- ✅ **Variáveis personalizadas** nos prompts de IA

---

## 📋 Passo 1: Obter Chave da API OpenAI

### 1.1 Criar conta na OpenAI

1. Acesse: https://platform.openai.com/signup
2. Crie uma conta (pode usar Google ou Microsoft)
3. Complete o cadastro

### 1.2 Obter API Key

1. Após fazer login, acesse: https://platform.openai.com/api-keys
2. Clique em **"Create new secret key"**
3. Dê um nome para a chave (ex: "Agente IA - Produção")
4. **COPIE A CHAVE IMEDIATAMENTE** - você só vê uma vez!
5. Guarde com segurança

### 1.3 Adicionar créditos (se necessário)

1. Acesse: https://platform.openai.com/account/billing
2. Adicione um método de pagamento
3. Configure um limite de gastos (recomendado)
4. Adicione créditos iniciais

---

## 📋 Passo 2: Configurar no Projeto

### 2.1 Adicionar variável de ambiente

Adicione no seu arquivo `.env` na raiz do projeto:

```env
# OpenAI API Key (para ChatGPT nos fluxos)
OPENAI_API_KEY=sk-sua-chave-aqui
```

**⚠️ Importante:**
- Substitua `sk-sua-chave-aqui` pela sua chave real
- Não commite o `.env` no Git (já deve estar no `.gitignore`)
- Guarde a chave com segurança

### 2.2 Adicionar no Vercel (Produção)

1. Acesse: https://vercel.com/dashboard
2. Vá em seu projeto → **Settings** → **Environment Variables**
3. Adicione:
   - **Nome:** `OPENAI_API_KEY`
   - **Valor:** Cole sua chave da API
   - **Environment:** Production, Preview, Development (marque todos)
4. Clique em **Save**
5. Faça um **redeploy** do projeto

---

## 📋 Passo 3: Criar Migration do Banco de Dados

Execute a migration para adicionar o campo `usesAI`:

```bash
npx prisma migrate dev --name add_uses_ai_to_workflow
```

Ou se estiver em produção:

```bash
npx prisma migrate deploy
```

---

## 🎯 Como Usar nos Fluxos

### 3.1 Criar um fluxo com IA

1. Vá em **Fluxos de Automação** → **Novo Fluxo**
2. Adicione um nó **🤖 IA** no canvas
3. Clique no nó e configure:
   - **Prompt do Sistema:** Instruções para personalizar a IA
     - Exemplo: "Você é um assistente de vendas amigável e prestativo..."
   - **Prompt:** O que a IA deve responder
     - Exemplo: "Responda à mensagem do usuário de forma útil e amigável"
   - **Temperatura:** 0.0 a 2.0 (padrão: 0.7)
     - Valores menores = respostas mais determinísticas
     - Valores maiores = respostas mais criativas
   - **Max Tokens:** Máximo de tokens na resposta (padrão: 500)
4. Conecte o nó de IA ao fluxo
5. Salve o workflow

### 3.2 Exemplo de Fluxo com IA

```
Trigger ("olá") 
  → Mensagem ("Olá! Como posso ajudar?")
  → 🤖 IA (responde perguntas do usuário)
  → Condição (usuário satisfeito?)
    ├─ Sim → Fechar Chat
    └─ Não → Transferir para Humano
```

---

## 💡 Recursos Disponíveis

### Variáveis nos Prompts

Você pode usar variáveis nos prompts de IA:

- `{{nome}}` - Nome do contato
- `{{telefone}}` - Telefone formatado
- `{{data}}` - Data atual
- `{{hora}}` - Hora atual
- `{{datahora}}` - Data e hora completas

**Exemplo de prompt:**
```
Olá {{nome}}! Hoje é {{data}}. Como posso ajudar?
```

### Contexto de Conversa

O sistema automaticamente:
- ✅ Busca as últimas 10 mensagens da conversa
- ✅ Envia como contexto para a IA
- ✅ Gera respostas mais contextualizadas

### Modelo Padrão

- **Modelo:** `gpt-3.5-turbo` (ChatGPT Mini)
- **Custo:** ~$0.002 por 1K tokens
- **Velocidade:** Rápida
- **Qualidade:** Excelente para a maioria dos casos

---

## 💰 Custos e Limites

### Preços (gpt-3.5-turbo)

- **Input:** $0.50 por 1M tokens
- **Output:** $1.50 por 1M tokens
- **Exemplo:** 1000 conversas/mês ≈ $1-5 USD

### Limites Recomendados

- Configure um **limite de gastos** na OpenAI
- Monitore o uso em: https://platform.openai.com/usage
- Use **Max Tokens** adequado (500-1000 para respostas curtas)

---

## 🔧 Troubleshooting

### Erro: "OPENAI_API_KEY não configurada"

**Solução:**
1. Verifique se a variável está no `.env`
2. Reinicie o servidor (`npm run dev`)
3. Verifique se está no Vercel (produção)

### Erro: "Insufficient quota"

**Solução:**
1. Adicione créditos na OpenAI
2. Verifique limites de gastos
3. Acesse: https://platform.openai.com/account/billing

### Respostas muito longas

**Solução:**
1. Reduza o **Max Tokens** no nó de IA
2. Ajuste o **Prompt** para ser mais específico
3. Use **Temperatura** menor (0.3-0.5)

### Respostas não contextualizadas

**Solução:**
1. Melhore o **Prompt do Sistema**
2. Adicione mais contexto no prompt
3. Verifique se o histórico de conversa está sendo usado

---

## ✅ Checklist

- [ ] Conta criada na OpenAI
- [ ] API Key obtida e copiada
- [ ] `OPENAI_API_KEY` adicionada no `.env`
- [ ] `OPENAI_API_KEY` adicionada no Vercel
- [ ] Migration executada (`usesAI` no banco)
- [ ] Servidor reiniciado
- [ ] Teste criando um fluxo com IA

---

## 📚 Recursos Adicionais

- **Documentação OpenAI:** https://platform.openai.com/docs
- **Preços:** https://openai.com/pricing
- **Status da API:** https://status.openai.com

---

Pronto! Agora você pode criar fluxos inteligentes com ChatGPT! 🚀

