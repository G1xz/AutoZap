# Midas AI - Relatórios Financeiros via Chat

## Funcionalidades Implementadas

### 1. Acesso aos Dados Financeiros
A API do chat agora tem acesso completo aos dados financeiros do usuário autenticado, incluindo:
- Saldo total
- Receitas e gastos mensais
- Investimentos
- Gastos por categoria
- Transações recentes
- Tendências de gastos

### 2. Relatórios Personalizados
O Midas pode agora gerar relatórios detalhados baseados nos dados reais do usuário:

#### Exemplos de Perguntas que o Midas pode responder:
- "Gere um relatório completo da minha situação financeira"
- "Analise meus gastos por categoria este mês"
- "Como posso economizar mais dinheiro?"
- "Qual é a tendência dos meus gastos?"
- "Me dê sugestões de investimento baseadas no meu perfil"
- "Compare meus gastos deste mês com o anterior"
- "Identifique padrões nos meus gastos"
- "Quais são minhas maiores despesas?"

### 3. Sugestões de Prompts
A interface do chat agora inclui sugestões de prompts relacionados a relatórios financeiros para facilitar o uso.

## Arquivos Modificados

### 1. `app/api/chat/route.ts`
- Adicionada autenticação com Clerk
- Integração com dados financeiros do usuário
- Prompt do sistema atualizado para análise de dados

### 2. `app/_data/get-user-financial-data/index.ts` (novo)
- Função para buscar dados financeiros completos do usuário
- Cálculos de saldo, tendências e categorias
- Interface TypeScript para tipagem dos dados

### 3. `app/_hooks/useChat.ts`
- Adicionada função `getSuggestedPrompts()`
- Estado para indicar disponibilidade de dados financeiros

### 4. `app/_components/chat-messages.tsx`
- Sugestões de prompts na tela inicial
- Melhor experiência do usuário

### 5. `app/midas/page.tsx`
- Integração das sugestões de prompts
- Interface atualizada

## Como Usar

1. Acesse a página do Midas (`/midas`)
2. Faça login com sua conta
3. Use as sugestões de prompts ou digite suas próprias perguntas
4. O Midas analisará seus dados financeiros e fornecerá insights personalizados

## Segurança

- Todos os dados são acessados apenas para o usuário autenticado
- A autenticação é verificada em cada requisição
- Os dados não são compartilhados entre usuários

## Próximos Passos

- Adicionar mais tipos de análise (análise de sazonalidade, projeções)
- Implementar exportação de relatórios
- Adicionar gráficos e visualizações nos relatórios
- Integrar com mais fontes de dados financeiros
