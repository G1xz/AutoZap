# Índice de Arquivos do Midas AI

Este documento lista todos os arquivos incluídos nesta pasta e suas funções principais.

## 📁 Estrutura Completa

### 🎨 Páginas e Componentes de Interface

#### `app/midas/page.tsx`
- **Função**: Página principal do chat do Midas
- **Características**:
  - Interface completa de chat (mobile e desktop)
  - Suporte a gravação de áudio
  - Upload e preview de imagens
  - Compressão de imagens no cliente
  - Sistema de comandos (palette)
  - Sugestões de prompts rotativas
  - Detecção de transações e abertura de diálogo

#### `app/midas/loading.tsx`
- **Função**: Componente de loading da página
- **Características**: Tela de carregamento com vídeo

#### `app/_components/chat-messages.tsx`
- **Função**: Componente de exibição de mensagens do chat
- **Características**:
  - Renderização de mensagens do usuário e assistente
  - Suporte a Markdown com ReactMarkdown
  - Exibição de imagens nas mensagens
  - Botão de copiar mensagens
  - Sugestões de prompts na tela inicial

#### `app/_components/midas-intro.tsx`
- **Função**: Componente de introdução do Midas
- **Características**: Tela de apresentação do Midas no onboarding

---

### 🔌 APIs (Backend)

#### `app/api/chat/route.ts`
- **Função**: API principal do chat com GPT-4
- **Características**:
  - Integração com OpenAI GPT-4o Mini
  - Detecção de intenção de transação
  - Extração de dados de transações (texto e imagem)
  - Análise de imagens de notas fiscais
  - Streaming de respostas
  - Consolidação de custos (Whisper + Chat)
  - Verificação de limites de plano
  - Geração de contexto financeiro melhorado

#### `app/api/chat/enhanced-context.ts`
- **Função**: Geração de contexto financeiro melhorado
- **Características**:
  - Busca todas as transações do usuário
  - Gera relatório financeiro completo
  - Formata contexto para GPT
  - Inclui histórico completo (não apenas mês atual)

#### `app/api/audio/transcribe/route.ts`
- **Função**: API de transcrição de áudio usando Whisper
- **Características**:
  - Integração com OpenAI Whisper
  - Retry com backoff exponencial
  - Validação de arquivo de áudio
  - Cálculo de custos do Whisper
  - Verificação de limites de plano
  - Suporte a múltiplos formatos de áudio

#### `app/api/upload-image/route.ts`
- **Função**: API de upload e compressão de imagens
- **Características**:
  - Upload de imagens para servidor
  - Compressão usando Sharp
  - Organização por usuário (pasta por userId)
  - Validação de tipo e tamanho

#### `app/api/check-midas-access/route.ts`
- **Função**: Verificação de acesso ao Midas
- **Características**: Verifica se o usuário tem plano ativo

---

### 🎣 Hooks (React)

#### `app/_hooks/useChat.ts`
- **Função**: Hook principal para gerenciar o estado do chat
- **Características**:
  - Gerenciamento de mensagens
  - Envio de mensagens (texto e imagem)
  - Processamento de áudio
  - Streaming de respostas
  - Detecção de transações
  - Sugestões de prompts
  - Tratamento de erros e limites

---

### 📊 Dados e Relatórios

#### `app/_data/get-user-financial-data/index.ts`
- **Função**: Busca dados financeiros completos do usuário
- **Características**:
  - Cálculo de saldo total
  - Receitas e gastos mensais
  - Investimentos
  - Gastos por categoria
  - Transações recentes
  - Tendências de gastos
  - Análise de estabelecimentos
  - Padrões de gastos (dia da semana, período do dia)
  - Insights de transações
  - Comparação mensal

#### `app/_data/generate-financial-report/`
Sistema completo de geração de relatórios financeiros:

- **`index.ts`**: Função principal que orquestra todo o sistema
- **`types.ts`**: Interfaces TypeScript para tipos de dados
- **`classification.ts`**: Classificação inteligente de transações
- **`anomaly-detection.ts`**: Detecção de anomalias nos gastos
- **`advanced-anomaly-detection.ts`**: Detecção avançada de anomalias
- **`recurrence-analysis.ts`**: Análise de transações recorrentes
- **`time-analysis.ts`**: Análise temporal (dia da semana, período do dia)
- **`monthly-comparison.ts`**: Comparação mensal detalhada
- **`projections.ts`**: Sistema de projeções financeiras
- **`smart-projections.ts`**: Projeções inteligentes baseadas em padrões
- **`converter.ts`**: Conversão de dados Prisma para formato do sistema
- **`exemplo-uso.ts`**: Exemplos práticos de uso
- **`README.md`**: Documentação completa do sistema

---

### 📚 Documentação

#### `docs/MIDAS_AI_SETUP.md`
- Guia de configuração do Midas
- Variáveis de ambiente necessárias
- Como obter API Key da OpenAI
- Funcionalidades implementadas
- Comandos disponíveis

#### `docs/MIDAS_CHAT_REPORTS.md`
- Documentação sobre relatórios via chat
- Exemplos de perguntas que o Midas pode responder
- Arquivos modificados
- Como usar

#### `docs/IMPLEMENTACAO_RELATORIOS_MELHORADOS.md`
- Documentação do sistema de relatórios melhorado
- Arquivos criados
- Funcionalidades implementadas
- Estrutura de arquivos

#### `README.md`
- Visão geral do sistema
- Estrutura de arquivos
- Funcionalidades principais
- Dependências necessárias
- Como usar
- Notas importantes

---

## 🔗 Dependências Externas Necessárias

### Bibliotecas NPM
- `openai` - SDK da OpenAI
- `@clerk/nextjs` - Autenticação (pode ser substituído)
- `framer-motion` - Animações
- `react-markdown` - Renderização de Markdown
- `remark-gfm` - Suporte a GitHub Flavored Markdown
- `browser-image-compression` - Compressão de imagens no cliente
- `sharp` - Processamento de imagens no servidor
- `@prisma/client` - ORM (pode ser substituído)

### Variáveis de Ambiente
- `OPENAI_API_KEY` - Chave da API da OpenAI

---

## 🎯 Fluxo Principal do Sistema

1. **Usuário envia mensagem** → `app/midas/page.tsx`
2. **Hook processa** → `app/_hooks/useChat.ts`
3. **API recebe** → `app/api/chat/route.ts`
4. **Detecção de transação** → `detectTransactionRequest()`
5. **Se transação detectada** → `extractTransactionData()`
6. **Geração de contexto** → `generateEnhancedFinancialContext()`
7. **Resposta do GPT** → Streaming ou resposta completa
8. **Frontend atualiza** → Mensagens renderizadas

---

## 💡 Pontos de Integração

### Para Adaptar em Outro Projeto:

1. **Autenticação**: Substituir `@clerk/nextjs` por seu sistema de auth
2. **Banco de Dados**: Substituir Prisma por seu ORM/banco
3. **Limites de Plano**: Adaptar `plan-limits.ts` (não incluído, mas referenciado)
4. **Tracking de Tokens**: Adaptar `token-tracking.ts` (não incluído, mas referenciado)
5. **Componentes UI**: Adaptar componentes de UI (Button, etc.) para sua biblioteca

---

## 📝 Notas Importantes

- Todos os arquivos mantêm as referências originais aos caminhos (`@/app/...`)
- Você precisará ajustar os imports conforme a estrutura do seu projeto
- O sistema de limites está integrado e pode precisar de ajustes
- Algumas funções dependem de bibliotecas específicas que podem ser substituídas

