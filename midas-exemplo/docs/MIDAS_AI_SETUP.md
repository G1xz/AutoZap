# Configuração da IA - Midas

## Variáveis de Ambiente Necessárias

Para que a integração com o GPT-4o Mini funcione corretamente, você precisa adicionar a seguinte variável de ambiente:

### OpenAI API Key
```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

## Como obter a API Key da OpenAI

1. Acesse [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Faça login na sua conta OpenAI
3. Clique em "Create new secret key"
4. Copie a chave gerada
5. Adicione no seu arquivo `.env.local`:

```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Configuração do Arquivo .env.local

Crie um arquivo `.env.local` na raiz do projeto com o seguinte conteúdo:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# Suas outras variáveis existentes...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
DATABASE_URL=your_database_url
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

## Funcionalidades Implementadas

✅ **Chat com IA**: Interface de chat integrada com GPT-4o Mini
✅ **Comandos Especializados**: Comandos específicos para finanças
✅ **Interface Responsiva**: Design adaptado para mobile e desktop
✅ **Animações**: Transições suaves e feedback visual
✅ **Tratamento de Erros**: Exibição de erros de forma amigável
✅ **Limpeza de Conversa**: Botão para limpar o histórico

## Comandos Disponíveis

- `/analise` - Análise Financeira
- `/relatorio` - Relatório Mensal  
- `/investir` - Dicas de Investimento
- `/planejar` - Planejamento Financeiro

## Próximos Passos

1. Adicione sua API Key da OpenAI
2. Reinicie o servidor de desenvolvimento
3. Teste a funcionalidade na página `/midas`
4. Personalize os prompts conforme necessário
