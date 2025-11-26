import {
  FinancialReport,
  Transaction,
  TopTransaction,
  CategoryAnalysis,
  Insight,
  AlternativeScenario,
  HistoricalPattern,
} from "./types";
import { classifyTransaction, categorizeTransaction } from "./classification";
import { detectAnomalies, detectTimeAnomalies } from "./anomaly-detection";
import {
  detectAdvancedAnomalies,
  detectSweetSpendingAnomalies,
} from "./advanced-anomaly-detection";
import { detectRecurringTransactions } from "./recurrence-analysis";
import {
  analyzeByDayOfWeek,
  analyzeByTimePeriod,
  analyzeByPaymentMethod,
} from "./time-analysis";
import { compareMonths, filterTransactionsByMonth } from "./monthly-comparison";
import { generateProjections, calculateReductionImpact } from "./projections";
import { generateSmartProjections } from "./smart-projections";

export async function generateFinancialReport(
  transactions: Transaction[],
  currentBalance: number = 0,
  targetMonth?: { year: number; month: number },
): Promise<FinancialReport> {
  if (transactions.length === 0) {
    return getEmptyReport();
  }

  // Determinar período de análise
  const now = new Date();
  const analysisYear = targetMonth?.year || now.getFullYear();
  const analysisMonth = targetMonth?.month || now.getMonth() + 1;

  // Se targetMonth não foi especificado, usar todas as transações para análise histórica completa
  const currentMonthTransactions = targetMonth 
    ? filterTransactionsByMonth(transactions, analysisYear, analysisMonth)
    : transactions; // Usar todas as transações para análise histórica completa

  // Filtrar transações do mês anterior (apenas se targetMonth foi especificado)
  const previousMonth = analysisMonth === 1 ? 12 : analysisMonth - 1;
  const previousYear = analysisMonth === 1 ? analysisYear - 1 : analysisYear;
  const previousMonthTransactions = targetMonth
    ? filterTransactionsByMonth(transactions, previousYear, previousMonth)
    : []; // Não filtrar mês anterior quando usando histórico completo

  // Classificar todas as transações
  const classifiedTransactions = currentMonthTransactions.map((transaction) => {
    const classification = classifyTransaction(transaction);
    const category = categorizeTransaction(transaction, classification);

    return {
      ...transaction,
      classification,
      category,
    };
  });

  // Separar receitas e despesas
  const incomeTransactions = classifiedTransactions.filter(
    (t) => t.classification.is_income,
  );
  const expenseTransactions = classifiedTransactions.filter(
    (t) => !t.classification.is_income,
  );

  // Calcular totais
  const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = expenseTransactions.reduce(
    (sum, t) => sum + Math.abs(t.amount),
    0,
  );
  const totalInvestments = classifiedTransactions
    .filter((t) => t.transaction_type === "INVESTMENT")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Gerar TOPs
  const topReceitas = generateTopTransactions(incomeTransactions, 10);
  const topDespesas = generateTopTransactions(expenseTransactions, 10);

  // Análise por categorias
  const categories = analyzeCategories(
    classifiedTransactions,
    totalIncome,
    totalExpenses,
  );

  // Detecção de anomalias melhorada
  const advancedAnomalyDetection = detectAdvancedAnomalies(
    classifiedTransactions,
    totalIncome,
    previousMonthTransactions,
  );

  // Detecção específica de gastos com doces
  const sweetSpendingAnomalies = detectSweetSpendingAnomalies(
    classifiedTransactions,
  );

  // Combinar todas as anomalias
  const allAnomalies = [
    ...detectAnomalies(classifiedTransactions, totalIncome, totalExpenses),
    ...detectTimeAnomalies(classifiedTransactions),
    ...advancedAnomalyDetection.anomalies,
    ...sweetSpendingAnomalies,
  ];

  // Análise de recorrência
  const recurring = detectRecurringTransactions(classifiedTransactions);

  // Análises temporais
  const byWeekday = analyzeByDayOfWeek(classifiedTransactions);
  const byPeriod = analyzeByTimePeriod(classifiedTransactions);
  const byPaymentMethod = analyzeByPaymentMethod(classifiedTransactions);

  // Comparação mensal
  const comparison = compareMonths(
    currentMonthTransactions,
    previousMonthTransactions,
  );

  // Projeções inteligentes
  const smartProjections = generateSmartProjections(
    classifiedTransactions,
    currentBalance,
  );
  smartProjections.impacto_reducao = calculateReductionImpact(categories);

  // Gerar insights melhorados
  const insights = generateEnhancedInsights({
    topReceitas,
    topDespesas,
    categories,
    anomalies: allAnomalies,
    categoryAlerts: advancedAnomalyDetection.categoryAlerts,
    spendingPatterns: advancedAnomalyDetection.spendingPatterns,
    recurring,
    comparison,
    projections: smartProjections,
    classifiedTransactions,
  });

  return {
    summary: {
      saldo_total: currentBalance,
      receitas_mes: totalIncome,
      gastos_mes: totalExpenses,
      investimentos_mes: totalInvestments,
      total_transacoes: classifiedTransactions.length,
    },
    top_receitas: topReceitas,
    top_despesas: topDespesas,
    categories,
    by_weekday: byWeekday,
    by_period: byPeriod,
    by_payment_method: byPaymentMethod,
    recurring,
    anomalies: allAnomalies,
    categoryAlerts: advancedAnomalyDetection.categoryAlerts,
    spendingPatterns: advancedAnomalyDetection.spendingPatterns,
    comparison,
    projections: smartProjections,
    insights,
    raw_transactions: currentMonthTransactions,
  };
}

function generateTopTransactions(
  transactions: Transaction[],
  limit: number,
): TopTransaction[] {
  // Agrupar por merchant
  const merchantGroups: { [key: string]: Transaction[] } = {};

  transactions.forEach((transaction) => {
    const merchant = transaction.merchant;
    if (!merchantGroups[merchant]) {
      merchantGroups[merchant] = [];
    }
    merchantGroups[merchant].push(transaction);
  });

  // Calcular estatísticas para cada merchant
  const topTransactions: TopTransaction[] = Object.entries(merchantGroups)
    .map(([merchant, merchantTransactions]) => {
      const total = merchantTransactions.reduce(
        (sum, t) => sum + Math.abs(t.amount),
        0,
      );
      const count = merchantTransactions.length;
      const average = total / count;

      // Encontrar a maior transação
      const largestTransaction = merchantTransactions.reduce((max, t) =>
        Math.abs(t.amount) > Math.abs(max.amount) ? t : max,
      );

      return {
        merchant,
        total,
        count,
        average,
        largest_date: largestTransaction.date,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);

  return topTransactions;
}

function analyzeCategories(
  transactions: Transaction[],
  totalIncome: number,
  totalExpenses: number,
): CategoryAnalysis[] {
  const categoryGroups: { [key: string]: Transaction[] } = {};

  transactions.forEach((transaction) => {
    const category = transaction.category || "OTHER";
    if (!categoryGroups[category]) {
      categoryGroups[category] = [];
    }
    categoryGroups[category].push(transaction);
  });

  // Calcular totais para percentuais

  return Object.entries(categoryGroups)
    .map(([category, categoryTransactions]) => {
      const totalAmount = categoryTransactions.reduce(
        (sum, t) => sum + Math.abs(t.amount),
        0,
      );
      const transactionCount = categoryTransactions.length;

      return {
        category,
        total_amount: totalAmount,
        transaction_count: transactionCount,
        percentage_of_total:
          totalAmount > 0
            ? (totalAmount / (totalIncome + totalExpenses)) * 100
            : 0,
        percentage_of_income:
          totalIncome > 0 && categoryTransactions.some((t) => t.amount > 0)
            ? (categoryTransactions
                .filter((t) => t.amount > 0)
                .reduce((sum, t) => sum + t.amount, 0) /
                totalIncome) *
              100
            : 0,
        percentage_of_expenses:
          totalExpenses > 0 && categoryTransactions.some((t) => t.amount < 0)
            ? (categoryTransactions
                .filter((t) => t.amount < 0)
                .reduce((sum, t) => sum + Math.abs(t.amount), 0) /
                totalExpenses) *
              100
            : 0,
      };
    })
    .sort((a, b) => b.total_amount - a.total_amount);
}

function generateEnhancedInsights(data: {
  topReceitas: TopTransaction[];
  topDespesas: TopTransaction[];
  categories: CategoryAnalysis[];
  anomalies: any[];
  categoryAlerts: any[];
  spendingPatterns: any[];
  recurring: any[];
  comparison: any;
  projections: any;
  classifiedTransactions: Transaction[];
}): Insight[] {
  const insights: Insight[] = [];

  // Insight sobre classificação de salário
  const salaryInExpenses = data.topDespesas.find(
    (t) =>
      t.merchant.toLowerCase().includes("salário") ||
      t.merchant.toLowerCase().includes("salary"),
  );

  if (salaryInExpenses) {
    insights.push({
      text: `Salário foi classificado como despesa - possível erro de classificação`,
      confidence: "alta",
      explanation: `Merchant "${salaryInExpenses.merchant}" contém palavra-chave de receita mas aparece em despesas`,
    });
  }

  // Insights sobre alertas de categoria
  data.categoryAlerts.forEach((alert) => {
    if (alert.severity === "critical" || alert.severity === "high") {
      insights.push({
        text: alert.message,
        confidence: alert.severity === "critical" ? "alta" : "média",
        explanation: `Aumento de ${alert.increasePercent.toFixed(1)}% em ${alert.category} - ${alert.suggestions.join(", ")}`,
      });
    }
  });

  // Insights sobre gastos com doces
  const sweetAnomalies = data.anomalies.filter(
    (a) =>
      a.reason.includes("doces") || a.reason.includes("frequência muito alta"),
  );
  if (sweetAnomalies.length > 0) {
    insights.push({
      text: `${sweetAnomalies.length} alerta(s) sobre gastos excessivos com doces/alimentos não essenciais`,
      confidence: "alta",
      explanation:
        "Considere reduzir a frequência de compras de doces e alimentos não essenciais",
    });
  }

  // Insights sobre padrões de gastos
  const highFrequencyPatterns = data.spendingPatterns.filter(
    (p) => p.frequency > 8,
  );
  if (highFrequencyPatterns.length > 0) {
    insights.push({
      text: `${highFrequencyPatterns.length} padrão(ões) de alta frequência detectado(s)`,
      confidence: "média",
      explanation:
        "Alguns merchants têm frequência muito alta de gastos - considere estabelecer limites",
    });
  }

  // Insights sobre projeções inteligentes
  if (data.projections.confidence === "alta") {
    if (data.projections.saldo_final_projetado < 0) {
      insights.push({
        text: "Projeção inteligente indica saldo negativo no final do mês",
        confidence: "alta",
        explanation: "Baseado em padrões históricos e ajustes sazonais",
      });
    }

    // Insights sobre cenários alternativos
    if (data.projections.alternativeScenarios) {
      const optimisticScenario = data.projections.alternativeScenarios.find(
        (s: AlternativeScenario) => s.name === "Cenário Otimista",
      );
      if (optimisticScenario) {
        insights.push({
          text: `Cenário otimista: saldo de R$ ${optimisticScenario.projectedBalance.toFixed(2)}`,
          confidence: "média",
          explanation: "Com redução de 20% nos gastos desnecessários",
        });
      }
    }
  }

  // Insights sobre padrões históricos
  if (data.projections.historicalPatterns) {
    const salaryPattern = data.projections.historicalPatterns.find(
      (p: HistoricalPattern) => p.patternType === "salary_cycle",
    );
    if (salaryPattern) {
      insights.push({
        text: `Padrão de receita regular identificado: ${salaryPattern.description}`,
        confidence: salaryPattern.confidence,
        explanation: "Sistema detectou padrão consistente de receitas",
      });
    }
  }

  // Insights tradicionais melhorados
  const highConfidenceAnomalies = data.anomalies.filter(
    (a: any) => a.confidence === "alta",
  );
  if (highConfidenceAnomalies.length > 0) {
    insights.push({
      text: `${highConfidenceAnomalies.length} transação(ões) anômala(s) detectada(s)`,
      confidence: "alta",
      explanation:
        "Transações com valores ou padrões atípicos foram identificadas",
    });
  }

  const otherCategory = data.categories.find(
    (c: any) => c.category === "OTHER",
  );
  if (otherCategory && otherCategory.percentage_of_total > 30) {
    insights.push({
      text: `${otherCategory.percentage_of_total.toFixed(1)}% das transações estão na categoria "Outros"`,
      confidence: "média",
      explanation:
        "Muitas transações não categorizadas - considere refinar as categorias",
    });
  }

  if (data.recurring.length > 0) {
    const highConfidenceRecurring = data.recurring.filter(
      (r: any) => r.confidence === "alta",
    );
    if (highConfidenceRecurring.length > 0) {
      insights.push({
        text: `${highConfidenceRecurring.length} transação(ões) recorrente(s) identificada(s)`,
        confidence: "alta",
        explanation: "Padrões de gastos recorrentes foram detectados",
      });
    }
  }

  return insights;
}

function getEmptyReport(): FinancialReport {
  return {
    summary: {
      saldo_total: 0,
      receitas_mes: 0,
      gastos_mes: 0,
      investimentos_mes: 0,
      total_transacoes: 0,
    },
    top_receitas: [],
    top_despesas: [],
    categories: [],
    by_weekday: [],
    by_period: [],
    by_payment_method: [],
    recurring: [],
    anomalies: [],
    comparison: {
      current_month: {
        receitas: 0,
        despesas: 0,
        transacoes: 0,
        media_por_transacao: 0,
      },
      previous_month: {
        receitas: 0,
        despesas: 0,
        transacoes: 0,
        media_por_transacao: 0,
      },
      variation: {
        receitas_percent: null,
        despesas_percent: null,
        transacoes_percent: null,
        media_percent: null,
      },
    },
    projections: {
      saldo_final_projetado: 0,
      dias_restantes: 0,
      gasto_diario_medio: 0,
      receita_diaria_media: 0,
      impacto_reducao: [],
      confidence: "baixa",
      historicalPatterns: [],
      seasonalAdjustments: [],
      confidenceFactors: [],
      alternativeScenarios: [],
    },
    categoryAlerts: [],
    spendingPatterns: [],
    insights: [],
    raw_transactions: [],
  };
}
