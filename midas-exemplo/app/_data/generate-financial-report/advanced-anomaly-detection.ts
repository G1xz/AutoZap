import { Anomaly, Transaction } from "./types";

export interface SpendingPattern {
  category: string;
  merchant: string;
  frequency: number; // vezes por mês
  averageAmount: number;
  totalAmount: number;
  lastOccurrence: Date;
  trend: "increasing" | "decreasing" | "stable";
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

export function detectAdvancedAnomalies(
  transactions: Transaction[],
  monthlyIncome: number,
  previousMonthTransactions: Transaction[] = [],
): {
  anomalies: Anomaly[];
  categoryAlerts: CategoryAlert[];
  spendingPatterns: SpendingPattern[];
} {
  const anomalies: Anomaly[] = [];
  const categoryAlerts: CategoryAlert[] = [];
  const spendingPatterns: SpendingPattern[] = [];

  if (transactions.length === 0) {
    return { anomalies, categoryAlerts, spendingPatterns };
  }

  // Detectar padrões de gastos por categoria
  const categoryPatterns = analyzeSpendingPatterns(
    transactions,
    previousMonthTransactions,
  );
  spendingPatterns.push(...categoryPatterns);

  // Detectar alertas de categoria
  const alerts = detectCategoryAlerts(
    transactions,
    previousMonthTransactions,
    monthlyIncome,
  );
  categoryAlerts.push(...alerts);

  // Detectar anomalias tradicionais melhoradas
  const traditionalAnomalies = detectEnhancedTraditionalAnomalies(
    transactions,
    monthlyIncome,
  );
  anomalies.push(...traditionalAnomalies);

  // Detectar anomalias de frequência
  const frequencyAnomalies = detectFrequencyAnomalies(
    transactions,
    categoryPatterns,
  );
  anomalies.push(...frequencyAnomalies);

  // Detectar anomalias de valor acumulado
  const cumulativeAnomalies = detectCumulativeAnomalies(
    transactions,
    monthlyIncome,
  );
  anomalies.push(...cumulativeAnomalies);

  return { anomalies, categoryAlerts, spendingPatterns };
}

function analyzeSpendingPatterns(
  currentTransactions: Transaction[],
  previousTransactions: Transaction[] = [],
): SpendingPattern[] {
  const patterns: SpendingPattern[] = [];

  // Agrupar por categoria e merchant
  const categoryMerchantGroups: { [key: string]: Transaction[] } = {};

  currentTransactions.forEach((transaction) => {
    const key = `${transaction.category || "OTHER"}|${transaction.merchant}`;
    if (!categoryMerchantGroups[key]) {
      categoryMerchantGroups[key] = [];
    }
    categoryMerchantGroups[key].push(transaction);
  });

  // Analisar cada grupo
  Object.entries(categoryMerchantGroups).forEach(([key, transactions]) => {
    const [category, merchant] = key.split("|");

    if (transactions.length < 2) return; // Precisa de pelo menos 2 transações para detectar padrão

    const amounts = transactions.map((t) => Math.abs(t.amount));
    const averageAmount =
      amounts.reduce((sum, val) => sum + val, 0) / amounts.length;
    const totalAmount = amounts.reduce((sum, val) => sum + val, 0);

    // Calcular frequência (transações por mês)
    const firstDate = new Date(
      Math.min(...transactions.map((t) => new Date(t.date).getTime())),
    );
    const lastDate = new Date(
      Math.max(...transactions.map((t) => new Date(t.date).getTime())),
    );
    const daysDiff = Math.max(
      1,
      (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const frequency = (transactions.length / daysDiff) * 30; // Normalizar para 30 dias

    // Determinar tendência
    const sortedTransactions = transactions.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const firstHalf = sortedTransactions.slice(
      0,
      Math.ceil(transactions.length / 2),
    );
    const secondHalf = sortedTransactions.slice(
      Math.floor(transactions.length / 2),
    );

    const firstHalfAvg =
      firstHalf.reduce((sum, t) => sum + Math.abs(t.amount), 0) /
      firstHalf.length;
    const secondHalfAvg =
      secondHalf.reduce((sum, t) => sum + Math.abs(t.amount), 0) /
      secondHalf.length;

    let trend: "increasing" | "decreasing" | "stable" = "stable";
    const changePercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

    if (changePercent > 20) trend = "increasing";
    else if (changePercent < -20) trend = "decreasing";

    patterns.push({
      category,
      merchant,
      frequency,
      averageAmount,
      totalAmount,
      lastOccurrence: lastDate,
      trend,
    });
  });

  return patterns.sort((a, b) => b.totalAmount - a.totalAmount);
}

function detectCategoryAlerts(
  currentTransactions: Transaction[],
  previousTransactions: Transaction[],
  monthlyIncome: number,
): CategoryAlert[] {
  const alerts: CategoryAlert[] = [];

  // Agrupar transações por categoria
  const currentByCategory = groupTransactionsByCategory(currentTransactions);
  const previousByCategory = groupTransactionsByCategory(previousTransactions);

  // Definir categorias que merecem atenção especial
  const alertCategories = [
    "FOOD",
    "ENTERTAINMENT",
    "SHOPPING",
    "HEALTH",
    "TRANSPORTATION",
    "EDUCATION",
    "SUBSCRIPTIONS",
    "OTHER",
  ];

  alertCategories.forEach((category) => {
    const currentSpending = currentByCategory[category] || 0;
    const previousSpending = previousByCategory[category] || 0;

    if (currentSpending === 0) return;

    const increasePercent =
      previousSpending > 0
        ? ((currentSpending - previousSpending) / previousSpending) * 100
        : 100;

    // Calcular aumento de frequência
    const currentFrequency = currentTransactions.filter(
      (t) => t.category === category,
    ).length;
    const previousFrequency = previousTransactions.filter(
      (t) => t.category === category,
    ).length;
    const frequencyIncrease =
      previousFrequency > 0
        ? ((currentFrequency - previousFrequency) / previousFrequency) * 100
        : 100;

    // Determinar severidade
    let severity: "low" | "medium" | "high" | "critical" = "low";
    let message = "";
    let suggestions: string[] = [];

    // Critérios para diferentes níveis de alerta
    const incomePercentage = (currentSpending / monthlyIncome) * 100;

    if (incomePercentage > 30 || increasePercent > 100) {
      severity = "critical";
      message = `Gastos excessivos em ${category}: R$ ${currentSpending.toFixed(2)} (${incomePercentage.toFixed(1)}% da renda)`;
      suggestions = [
        "Considere reduzir gastos nesta categoria",
        "Analise se todos os gastos são necessários",
        "Procure alternativas mais econômicas",
      ];
    } else if (incomePercentage > 20 || increasePercent > 50) {
      severity = "high";
      message = `Aumento significativo em ${category}: R$ ${currentSpending.toFixed(2)} (+${increasePercent.toFixed(1)}%)`;
      suggestions = [
        "Monitore seus gastos nesta categoria",
        "Considere estabelecer um limite mensal",
      ];
    } else if (increasePercent > 25 || frequencyIncrease > 50) {
      severity = "medium";
      message = `Aumento moderado em ${category}: R$ ${currentSpending.toFixed(2)} (+${increasePercent.toFixed(1)}%)`;
      suggestions = [
        "Acompanhe a evolução dos gastos",
        "Considere se o aumento é justificado",
      ];
    } else if (increasePercent > 10) {
      severity = "low";
      message = `Pequeno aumento em ${category}: R$ ${currentSpending.toFixed(2)} (+${increasePercent.toFixed(1)}%)`;
      suggestions = ["Continue monitorando"];
    }

    if (severity !== "low") {
      alerts.push({
        category,
        currentSpending,
        previousMonthSpending: previousSpending,
        increasePercent,
        frequencyIncrease,
        severity,
        message,
        suggestions,
      });
    }
  });

  return alerts.sort((a, b) => {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });
}

function detectEnhancedTraditionalAnomalies(
  transactions: Transaction[],
  monthlyIncome: number,
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Detectar gastos muito altos em relação à renda
  transactions.forEach((transaction) => {
    const amount = Math.abs(transaction.amount);
    const incomePercentage = (amount / monthlyIncome) * 100;

    // Gastos que representam mais de 25% da renda mensal
    if (incomePercentage > 25) {
      anomalies.push({
        id: transaction.id,
        merchant: transaction.merchant,
        amount: transaction.amount,
        reason: `Gasto representa ${incomePercentage.toFixed(1)}% da renda mensal`,
        confidence: "alta",
        explanation: `Transação de R$ ${amount.toFixed(2)} no merchant "${transaction.merchant}" representa uma porcentagem muito alta da sua renda mensal`,
      });
    }

    // Gastos em categorias específicas que podem ser problemáticos
    const problematicCategories = ["ENTERTAINMENT", "SHOPPING", "FOOD"];
    if (
      problematicCategories.includes(transaction.category || "") &&
      amount > 200
    ) {
      anomalies.push({
        id: transaction.id,
        merchant: transaction.merchant,
        amount: transaction.amount,
        reason: `Gasto alto em ${transaction.category}`,
        confidence: "média",
        explanation: `Transação de R$ ${amount.toFixed(2)} em categoria ${transaction.category} - considere se é necessário`,
      });
    }
  });

  return anomalies;
}

function detectFrequencyAnomalies(
  transactions: Transaction[],
  patterns: SpendingPattern[],
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  patterns.forEach((pattern) => {
    // Detectar frequência muito alta (mais de 10 vezes por mês)
    if (pattern.frequency > 10) {
      const relatedTransactions = transactions.filter(
        (t) =>
          t.category === pattern.category && t.merchant === pattern.merchant,
      );

      if (relatedTransactions.length > 0) {
        const latestTransaction =
          relatedTransactions[relatedTransactions.length - 1];
        anomalies.push({
          id: latestTransaction.id,
          merchant: pattern.merchant,
          amount: latestTransaction.amount,
          reason: `Frequência muito alta: ${pattern.frequency.toFixed(1)} vezes por mês`,
          confidence: "alta",
          explanation: `Você está gastando ${pattern.frequency.toFixed(1)} vezes por mês em "${pattern.merchant}" - considere reduzir a frequência`,
        });
      }
    }

    // Detectar tendência crescente preocupante
    if (pattern.trend === "increasing" && pattern.frequency > 5) {
      const relatedTransactions = transactions.filter(
        (t) =>
          t.category === pattern.category && t.merchant === pattern.merchant,
      );

      if (relatedTransactions.length > 0) {
        const latestTransaction =
          relatedTransactions[relatedTransactions.length - 1];
        anomalies.push({
          id: latestTransaction.id,
          merchant: pattern.merchant,
          amount: latestTransaction.amount,
          reason: "Tendência crescente preocupante",
          confidence: "média",
          explanation: `Gastos em "${pattern.merchant}" estão aumentando - considere estabelecer um limite`,
        });
      }
    }
  });

  return anomalies;
}

function detectCumulativeAnomalies(
  transactions: Transaction[],
  monthlyIncome: number,
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Agrupar por categoria e detectar gastos acumulados
  const categoryGroups: { [key: string]: Transaction[] } = {};

  transactions.forEach((transaction) => {
    const category = transaction.category || "OTHER";
    if (!categoryGroups[category]) {
      categoryGroups[category] = [];
    }
    categoryGroups[category].push(transaction);
  });

  Object.entries(categoryGroups).forEach(([category, categoryTransactions]) => {
    const totalSpending = categoryTransactions.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0,
    );
    const incomePercentage = (totalSpending / monthlyIncome) * 100;

    // Gastos acumulados que representam mais de 40% da renda
    if (incomePercentage > 40) {
      const latestTransaction =
        categoryTransactions[categoryTransactions.length - 1];
      anomalies.push({
        id: latestTransaction.id,
        merchant: latestTransaction.merchant,
        amount: latestTransaction.amount,
        reason: `Gastos acumulados em ${category} representam ${incomePercentage.toFixed(1)}% da renda`,
        confidence: "alta",
        explanation: `Total gasto em ${category} este mês: R$ ${totalSpending.toFixed(2)} - representa uma porcentagem muito alta da sua renda`,
      });
    }
  });

  return anomalies;
}

function groupTransactionsByCategory(transactions: Transaction[]): {
  [key: string]: number;
} {
  const groups: { [key: string]: number } = {};

  transactions.forEach((transaction) => {
    const category = transaction.category || "OTHER";
    if (!groups[category]) {
      groups[category] = 0;
    }
    groups[category] += Math.abs(transaction.amount);
  });

  return groups;
}

// Função específica para detectar gastos excessivos com doces
export function detectSweetSpendingAnomalies(
  transactions: Transaction[],
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Palavras-chave relacionadas a doces e alimentos não essenciais
  const sweetKeywords = [
    "doce",
    "doces",
    "chocolate",
    "balas",
    "bombons",
    "sorvete",
    "sorvetes",
    "açúcar",
    "açucar",
    "confeitaria",
    "confeitaria",
    "padaria",
    "padarias",
    "lanchonete",
    "lanchonetes",
    "fast food",
    "mcdonalds",
    "burger king",
    "subway",
    "kfc",
    "pizza",
    "pizzaria",
    "delivery",
    "ifood",
    "uber eats",
    "rappi",
    "iFood",
    "Uber Eats",
    "Rappi",
  ];

  // Agrupar transações relacionadas a doces
  const sweetTransactions = transactions.filter((transaction) => {
    const merchantLower = transaction.merchant.toLowerCase();
    return sweetKeywords.some((keyword) =>
      merchantLower.includes(keyword.toLowerCase()),
    );
  });

  if (sweetTransactions.length === 0) return anomalies;

  // Calcular estatísticas
  const totalSweetSpending = sweetTransactions.reduce(
    (sum, t) => sum + Math.abs(t.amount),
    0,
  );
  const averageSweetSpending = totalSweetSpending / sweetTransactions.length;
  const frequency = sweetTransactions.length;

  // Detectar anomalias baseadas em frequência e valor
  if (frequency > 10) {
    // Mais de 10 compras de doces no mês
    const latestTransaction = sweetTransactions[sweetTransactions.length - 1];
    anomalies.push({
      id: latestTransaction.id,
      merchant: latestTransaction.merchant,
      amount: latestTransaction.amount,
      reason: `Frequência alta de gastos com doces: ${frequency} vezes no mês`,
      confidence: "alta",
      explanation: `Você comprou doces/alimentos não essenciais ${frequency} vezes este mês, totalizando R$ ${totalSweetSpending.toFixed(2)}`,
    });
  }

  if (totalSweetSpending > 200) {
    // Mais de R$ 200 em doces
    const latestTransaction = sweetTransactions[sweetTransactions.length - 1];
    anomalies.push({
      id: latestTransaction.id,
      merchant: latestTransaction.merchant,
      amount: latestTransaction.amount,
      reason: `Gasto total alto com doces: R$ ${totalSweetSpending.toFixed(2)}`,
      confidence: "média",
      explanation: `Você gastou R$ ${totalSweetSpending.toFixed(2)} com doces/alimentos não essenciais este mês - considere reduzir`,
    });
  }

  // Detectar padrão de gastos crescentes
  const sortedTransactions = sweetTransactions.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  if (sortedTransactions.length >= 4) {
    const firstHalf = sortedTransactions.slice(
      0,
      Math.ceil(sortedTransactions.length / 2),
    );
    const secondHalf = sortedTransactions.slice(
      Math.floor(sortedTransactions.length / 2),
    );

    const firstHalfAvg =
      firstHalf.reduce((sum, t) => sum + Math.abs(t.amount), 0) /
      firstHalf.length;
    const secondHalfAvg =
      secondHalf.reduce((sum, t) => sum + Math.abs(t.amount), 0) /
      secondHalf.length;

    const increasePercent =
      ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

    if (increasePercent > 30) {
      const latestTransaction =
        sortedTransactions[sortedTransactions.length - 1];
      anomalies.push({
        id: latestTransaction.id,
        merchant: latestTransaction.merchant,
        amount: latestTransaction.amount,
        reason: `Tendência crescente nos gastos com doces: +${increasePercent.toFixed(1)}%`,
        confidence: "média",
        explanation: `Seus gastos com doces estão aumentando - considere estabelecer um limite mensal`,
      });
    }
  }

  return anomalies;
}
