export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD format
  amount: number; // positivo = receita, negativo = despesa
  merchant: string;
  category?: string;
  payment_method: string;
  transaction_type?: string; // DEPOSIT, WITHDRAWAL, EXPENSE, INCOME
  notes?: string;
}

export interface TopTransaction {
  merchant: string;
  total: number;
  count: number;
  average: number;
  largest_date: string;
}

export interface CategoryAnalysis {
  category: string;
  total_amount: number;
  transaction_count: number;
  percentage_of_total: number;
  percentage_of_income?: number;
  percentage_of_expenses?: number;
}

export interface Anomaly {
  id: string;
  merchant: string;
  amount: number;
  reason: string;
  confidence: "alta" | "média" | "baixa";
  explanation: string;
}

export interface RecurringTransaction {
  merchant: string;
  average_amount: number;
  frequency_days: number;
  last_transaction: string;
  total_transactions: number;
  confidence: "alta" | "média" | "baixa";
}

export interface DayOfWeekAnalysis {
  day: string;
  total_amount: number;
  transaction_count: number;
  average_amount: number;
}

export interface TimePeriodAnalysis {
  period: string; // Manhã, Tarde, Noite, Madrugada
  total_amount: number;
  transaction_count: number;
  average_amount: number;
}

export interface PaymentMethodAnalysis {
  method: string;
  total_amount: number;
  transaction_count: number;
  percentage_of_total: number;
  percentage_of_transactions: number;
}

export interface MonthlyComparison {
  current_month: {
    receitas: number;
    despesas: number;
    transacoes: number;
    media_por_transacao: number;
  };
  previous_month: {
    receitas: number;
    despesas: number;
    transacoes: number;
    media_por_transacao: number;
  };
  variation: {
    receitas_percent: number | null;
    despesas_percent: number | null;
    transacoes_percent: number | null;
    media_percent: number | null;
  };
  notes?: string[];
}

export interface Projection {
  saldo_final_projetado: number;
  dias_restantes: number;
  gasto_diario_medio: number;
  receita_diaria_media: number;
  impacto_reducao: Array<{
    categoria: string;
    reducao_percent: number;
    economia_projetada: number;
  }>;
  confidence: "alta" | "média" | "baixa";
}

export interface Insight {
  text: string;
  confidence: "alta" | "média" | "baixa";
  explanation: string;
}

export interface FinancialReport {
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
  categoryAlerts: CategoryAlert[];
  spendingPatterns: SpendingPattern[];
  comparison: MonthlyComparison;
  projections: SmartProjection;
  insights: Insight[];
  raw_transactions: Transaction[]; // Para auditoria
}

export interface CategoryAlert {
  category: string;
  currentSpending: number;
  previousMonthSpending: number;
  increasePercent: number;
  frequencyIncrease: number;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  suggestions: string[];
}

export interface SpendingPattern {
  category: string;
  merchant: string;
  frequency: number; // vezes por mês
  averageAmount: number;
  totalAmount: number;
  lastOccurrence: Date;
  trend: "increasing" | "decreasing" | "stable";
}

export interface HistoricalPattern {
  patternType: "weekly" | "monthly" | "seasonal" | "salary_cycle";
  description: string;
  confidence: "alta" | "média" | "baixa";
  impact: number; // Impacto na projeção em %
  examples: string[];
}

export interface SeasonalAdjustment {
  month: number;
  adjustmentFactor: number; // Fator de ajuste (1.0 = normal, 1.2 = 20% acima)
  reason: string;
  confidence: "alta" | "média" | "baixa";
}

export interface ConfidenceFactor {
  factor: string;
  impact: "positive" | "negative" | "neutral";
  description: string;
  weight: number; // Peso na confiança geral (0-1)
}

export interface AlternativeScenario {
  name: string;
  description: string;
  projectedBalance: number;
  probability: number; // Probabilidade de ocorrer (0-1)
  assumptions: string[];
}

export interface SmartProjection extends Projection {
  historicalPatterns: HistoricalPattern[];
  seasonalAdjustments: SeasonalAdjustment[];
  confidenceFactors: ConfidenceFactor[];
  alternativeScenarios: AlternativeScenario[];
}

export interface ClassificationResult {
  is_income: boolean;
  confidence: "alta" | "média" | "baixa";
  reason: string;
  conflict_flag: boolean;
}

export interface MerchantHeuristics {
  income_keywords: string[];
  expense_keywords: string[];
  suspicious_keywords: string[];
  refund_keywords: string[];
}
