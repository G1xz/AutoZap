# Sistema de Relatórios Financeiros Melhorado - CoinQi

## Visão Geral

Este sistema implementa um relatório financeiro avançado que corrige problemas de classificação, detecta anomalias, analisa padrões e gera insights úteis para o usuário.

## Funcionalidades Principais

### 1. Classificação Inteligente de Transações
- **Heurísticas de Merchant**: Detecta automaticamente receitas baseado em palavras-chave como "salário", "salary", "payroll"
- **Override por Transaction Type**: Prioriza o tipo da transação quando disponível
- **Detecção de Conflitos**: Identifica quando há inconsistências entre amount e merchant/type
- **Confiança Graduada**: Alta, média ou baixa confiança para cada classificação

### 2. Separação Clara de Receitas e Despesas
- **Top 10 Receitas**: Lista separada das maiores receitas por valor
- **Top 10 Despesas**: Lista separada das maiores despesas por valor
- **Validação**: Salário nunca aparece em despesas (critério de aceitação)

### 3. Detecção de Anomalias
- **Valores Atípicos**: Transações > 3x desvio padrão ou > 20% da receita mensal
- **Merchants Suspeitos**: Detecta "Gacha", "Game", valores com padrões estranhos (6666, etc.)
- **Inconsistências**: Salário em despesas, despesas em receitas
- **Horários Atípicos**: Gastos grandes na madrugada

### 4. Análise de Recorrência
- **Padrões Temporais**: Detecta transações com valores similares (±10%) e intervalos consistentes (±3 dias)
- **Confiança Graduada**: Baseada na consistência dos dados
- **Fluxos Fixos**: Separa receitas fixas, despesas fixas e variáveis

### 5. Análise Temporal
- **Por Dia da Semana**: Gastos por dia
- **Por Período**: Manhã, Tarde, Noite, Madrugada
- **Por Método de Pagamento**: Distribuição percentual
- **Padrões**: Weekend vs weekday, horários de pico

### 6. Comparação Mensal
- **Variações Percentuais**: Compara mês atual vs anterior
- **Tratamento de Zero**: Evita divisão por zero quando mês anterior não tem dados
- **Insights**: Identifica tendências significativas

### 7. Projeções
- **Saldo Final**: Projeção baseada na média diária
- **Impacto de Redução**: Simula economia por categoria
- **Confiança**: Baseada na quantidade de dados disponíveis

## Estrutura de Arquivos

```
app/_data/generate-financial-report/
├── types.ts                 # Interfaces TypeScript
├── classification.ts        # Lógica de classificação
├── anomaly-detection.ts     # Detecção de anomalias
├── recurrence-analysis.ts   # Análise de recorrência
├── time-analysis.ts         # Análise temporal
├── monthly-comparison.ts    # Comparação mensal
├── projections.ts           # Sistema de projeções
├── converter.ts             # Conversão Prisma → Sistema
├── index.ts                 # Função principal
├── tests.ts                 # Testes unitários
└── README.md                # Esta documentação
```

## Uso

### Geração de Relatório Completo

```typescript
import { generateFinancialReport } from '@/app/_data/generate-financial-report';

const report = await generateFinancialReport(transactions, currentBalance);
```

### Classificação Individual

```typescript
import { classifyTransaction } from '@/app/_data/generate-financial-report/classification';

const classification = classifyTransaction(transaction);
```

### Detecção de Anomalias

```typescript
import { detectAnomalies } from '@/app/_data/generate-financial-report/anomaly-detection';

const anomalies = detectAnomalies(transactions, monthlyIncome, monthlyExpenses);
```

## Formato de Entrada

```typescript
interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // positivo = receita, negativo = despesa
  merchant: string;
  category?: string;
  payment_method: string;
  transaction_type?: string; // DEPOSIT, WITHDRAWAL, EXPENSE, INCOME
  notes?: string;
}
```

## Formato de Saída

```typescript
interface FinancialReport {
  summary: {
    saldo_total: number;
    receitas_mes: number;
    gastos_mes: number;
    investimentos_mes: number;
    total_transacoes: number;
  };
  top_receitas: TopTransaction[];
  top_despesas: TopTransaction[];
  categories: CategoryAnalysis[];
  by_weekday: DayOfWeekAnalysis[];
  by_period: TimePeriodAnalysis[];
  by_payment_method: PaymentMethodAnalysis[];
  recurring: RecurringTransaction[];
  anomalies: Anomaly[];
  comparison: MonthlyComparison;
  projections: Projection;
  insights: Insight[];
  raw_transactions: Transaction[];
}
```

## Critérios de Aceitação

✅ **Salário nunca aparece em top_despesas**
✅ **sum(top_receitas.total) ≈ receitas_mes (tolerância < 1%)**
✅ **sum(top_despesas.total) ≈ gastos_mes**
✅ **Cada anomaly inclui explanation e confidence**
✅ **Comparação mensal trata divisão por zero**
✅ **Insights com confiança graduada**

## Exemplo de Uso

```typescript
// Dados de entrada
const transactions = [
  {
    id: "1",
    date: "2025-09-08",
    amount: 10000,
    merchant: "Salário Empresa X",
    category: "SALARY",
    payment_method: "PIX",
    transaction_type: "DEPOSIT"
  },
  {
    id: "2",
    date: "2025-09-10", 
    amount: -300,
    merchant: "Mercado",
    category: "FOOD",
    payment_method: "CASH",
    transaction_type: "EXPENSE"
  },
  {
    id: "3",
    date: "2025-09-11",
    amount: -6666,
    merchant: "Gacha", 
    category: "OTHER",
    payment_method: "PIX",
    transaction_type: "EXPENSE"
  }
];

// Gerar relatório
const report = await generateFinancialReport(transactions, 0);

// Resultado esperado:
// - Salário em top_receitas (não em despesas)
// - Gacha detectado como anomalia
// - Insights sobre classificação correta
```

## Integração com API de Chat

O sistema está integrado com a API de chat (`/api/chat/route.ts`) através da função `generateEnhancedFinancialContext()`, que substitui o sistema anterior de contexto financeiro.

## Testes

Execute os testes com:

```typescript
import { runTests } from '@/app/_data/generate-financial-report/tests';

runTests();
```

## Logs de Confiança

O sistema registra logs de confiança para cada regra aplicada:
- "heurística merchant → receita aplicada"
- "transaction_type → receita aplicada" 
- "classificação baseada no amount"

## Boas Práticas

1. **Preservar Raw Input**: Sempre manter transações originais para auditoria
2. **Confiança Graduada**: Usar alta/média/baixa para todas as análises
3. **Tratamento de Conflitos**: Marcar quando há inconsistências
4. **Normalização**: Usar lowercase trimming para comparações
5. **Linguagem Humana**: Gerar insights em 1-3 frases para leitura rápida
