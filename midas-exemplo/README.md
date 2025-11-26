# Midas AI - Estrutura Completa para Exemplo

Esta pasta contém todos os arquivos relacionados ao sistema Midas AI, organizados para facilitar a reutilização como exemplo em outros projetos.

## 📁 Estrutura de Arquivos

### Páginas
- `app/midas/page.tsx` - Página principal do chat do Midas
- `app/midas/loading.tsx` - Componente de loading da página

### APIs
- `app/api/chat/route.ts` - API principal do chat com GPT-4
- `app/api/chat/enhanced-context.ts` - Geração de contexto financeiro melhorado
- `app/api/audio/transcribe/route.ts` - API de transcrição de áudio (Whisper)
- `app/api/upload-image/route.ts` - API de upload e compressão de imagens
- `app/api/check-midas-access/route.ts` - Verificação de acesso ao Midas

### Hooks
- `app/_hooks/useChat.ts` - Hook principal para gerenciar o estado do chat

### Componentes
- `app/_components/chat-messages.tsx` - Componente de exibição de mensagens do chat
- `app/_components/midas-intro.tsx` - Componente de introdução do Midas

### Dados e Relatórios
- `app/_data/get-user-financial-data/index.ts` - Busca dados financeiros do usuário
- `app/_data/generate-financial-report/` - Sistema completo de geração de relatórios financeiros
  - `types.ts` - Tipos TypeScript
  - `classification.ts` - Classificação inteligente de transações
  - `anomaly-detection.ts` - Detecção de anomalias
  - `recurrence-analysis.ts` - Análise de recorrência
  - `time-analysis.ts` - Análise temporal
  - `monthly-comparison.ts` - Comparação mensal
  - `projections.ts` - Sistema de projeções
  - `converter.ts` - Conversão Prisma → Sistema
  - `index.ts` - Função principal
  - `README.md` - Documentação do sistema

### Documentação
- `docs/MIDAS_AI_SETUP.md` - Guia de configuração do Midas
- `docs/MIDAS_CHAT_REPORTS.md` - Documentação sobre relatórios via chat
- `docs/IMPLEMENTACAO_RELATORIOS_MELHORADOS.md` - Documentação do sistema de relatórios melhorado

## 🚀 Funcionalidades Principais

### 1. Chat com IA
- Integração com GPT-4o Mini
- Streaming de respostas
- Suporte a imagens (GPT-4 Vision)
- Suporte a áudio (Whisper)

### 2. Análise de Transações
- Detecção automática de intenção de transação
- Extração de dados de notas fiscais via imagem
- Processamento de áudio para registro de transações

### 3. Relatórios Financeiros
- Geração de relatórios completos
- Análise por categorias
- Detecção de anomalias
- Identificação de padrões recorrentes
- Projeções inteligentes
- Comparação mensal

### 4. Contexto Financeiro
- Acesso completo ao histórico financeiro
- Análise detalhada de estabelecimentos
- Padrões de gastos por dia da semana e período do dia
- Insights de transações

## 📋 Dependências Necessárias

### NPM Packages
```json
{
  "openai": "^4.x",
  "@clerk/nextjs": "^5.x",
  "framer-motion": "^10.x",
  "react-markdown": "^8.x",
  "remark-gfm": "^3.x",
  "browser-image-compression": "^2.x",
  "sharp": "^0.32.x"
}
```

### Variáveis de Ambiente
```env
OPENAI_API_KEY=sk-your-openai-api-key-here
```

## 🔧 Como Usar

1. Copie a pasta `midas-exemplo` para seu projeto
2. Ajuste os imports conforme necessário (caminhos podem variar)
3. Configure as variáveis de ambiente
4. Instale as dependências necessárias
5. Adapte as funções de autenticação e banco de dados conforme seu projeto

## 📝 Notas Importantes

- Os arquivos mantêm as referências originais aos caminhos do projeto (`@/app/...`)
- Você precisará ajustar os imports conforme a estrutura do seu projeto
- Algumas funções dependem de bibliotecas específicas (Clerk para auth, Prisma para DB)
- O sistema de limites de plano está integrado e pode precisar de ajustes

## 🎯 Arquivos Principais para Entender o Sistema

1. **`app/api/chat/route.ts`** - Lógica principal do chat e detecção de transações
2. **`app/_hooks/useChat.ts`** - Gerenciamento de estado do chat no frontend
3. **`app/midas/page.tsx`** - Interface do usuário completa
4. **`app/_data/generate-financial-report/index.ts`** - Sistema de relatórios

## 💡 Dicas

- Comece pelo arquivo `app/api/chat/route.ts` para entender o fluxo principal
- O sistema usa streaming para melhor UX nas respostas
- A detecção de transações usa GPT-4 para análise de intenção
- O sistema de relatórios é modular e pode ser usado independentemente

