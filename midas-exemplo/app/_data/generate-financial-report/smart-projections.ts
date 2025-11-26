import { Projection, Transaction } from "./types";

export interface SmartProjection extends Projection {
  historicalPatterns: HistoricalPattern[];
  seasonalAdjustments: SeasonalAdjustment[];
  confidenceFactors: ConfidenceFactor[];
  alternativeScenarios: AlternativeScenario[];
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

export function generateSmartProjections(
  transactions: Transaction[],
  currentBalance: number,
  currentDate: Date = new Date(),
): SmartProjection {
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  // Calcular dias restantes no mês
  const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();
  const daysRemaining = lastDayOfMonth - currentDate.getDate() + 1;

  // Analisar padrões históricos
  const historicalPatterns = analyzeHistoricalPatterns(
    transactions,
    currentDate,
  );

  // Calcular ajustes sazonais
  const seasonalAdjustments = calculateSeasonalAdjustments(
    transactions,
    currentMonth,
  );

  // Gerar projeção base
  const baseProjection = generateBaseProjection(
    transactions,
    currentBalance,
    currentDate,
  );

  // Aplicar ajustes baseados em padrões
  const adjustedProjection = applyPatternAdjustments(
    baseProjection,
    historicalPatterns,
    seasonalAdjustments,
  );

  // Calcular fatores de confiança
  const confidenceFactors = calculateConfidenceFactors(
    transactions,
    historicalPatterns,
    currentDate,
  );

  // Gerar cenários alternativos
  const alternativeScenarios = generateAlternativeScenarios(
    adjustedProjection,
    historicalPatterns,
    seasonalAdjustments,
  );

  // Calcular confiança geral
  const overallConfidence = calculateOverallConfidence(confidenceFactors);

  return {
    ...adjustedProjection,
    confidence: overallConfidence,
    historicalPatterns,
    seasonalAdjustments,
    confidenceFactors,
    alternativeScenarios,
  };
}

function analyzeHistoricalPatterns(
  transactions: Transaction[],
  currentDate: Date,
): HistoricalPattern[] {
  const patterns: HistoricalPattern[] = [];

  if (transactions.length < 10) {
    return patterns; // Precisa de dados suficientes
  }

  // Analisar padrão de salário (receitas regulares)
  const salaryPattern = analyzeSalaryPattern(transactions, currentDate);
  if (salaryPattern) {
    patterns.push(salaryPattern);
  }

  // Analisar padrão semanal
  const weeklyPattern = analyzeWeeklyPattern(transactions);
  if (weeklyPattern) {
    patterns.push(weeklyPattern);
  }

  // Analisar padrão mensal
  const monthlyPattern = analyzeMonthlyPattern(transactions, currentDate);
  if (monthlyPattern) {
    patterns.push(monthlyPattern);
  }

  // Analisar padrão sazonal
  const seasonalPattern = analyzeSeasonalPattern(transactions);
  if (seasonalPattern) {
    patterns.push(seasonalPattern);
  }

  return patterns;
}

function analyzeSalaryPattern(
  transactions: Transaction[],
  currentDate: Date,
): HistoricalPattern | null {
  const incomeTransactions = transactions.filter((t) => t.amount > 0);

  if (incomeTransactions.length < 3) return null;

  // Agrupar receitas por merchant
  const incomeByMerchant: { [key: string]: Transaction[] } = {};
  incomeTransactions.forEach((t) => {
    if (!incomeByMerchant[t.merchant]) {
      incomeByMerchant[t.merchant] = [];
    }
    incomeByMerchant[t.merchant].push(t);
  });

  // Procurar por padrões de salário (receitas regulares)
  for (const [merchant, merchantTransactions] of Object.entries(
    incomeByMerchant,
  )) {
    if (merchantTransactions.length < 3) continue;

    // Calcular intervalos entre receitas
    const sortedTransactions = merchantTransactions.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    const intervals: number[] = [];
    for (let i = 1; i < sortedTransactions.length; i++) {
      const prevDate = new Date(sortedTransactions[i - 1].date);
      const currDate = new Date(sortedTransactions[i].date);
      const intervalDays =
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
      intervals.push(intervalDays);
    }

    // Calcular média e desvio padrão dos intervalos
    const avgInterval =
      intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const variance =
      intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) /
      intervals.length;
    const stdDev = Math.sqrt(variance);

    // Se o desvio padrão é baixo, é um padrão regular
    if (stdDev < 5 && avgInterval > 20 && avgInterval < 35) {
      const lastTransaction = sortedTransactions[sortedTransactions.length - 1];
      const daysSinceLastSalary =
        (currentDate.getTime() - new Date(lastTransaction.date).getTime()) /
        (1000 * 60 * 60 * 24);

      let confidence: "alta" | "média" | "baixa" = "baixa";
      if (intervals.length >= 5 && stdDev < 3) confidence = "alta";
      else if (intervals.length >= 3 && stdDev < 5) confidence = "média";

      return {
        patternType: "salary_cycle",
        description: `Receita regular de ${merchant} a cada ${avgInterval.toFixed(0)} dias`,
        confidence,
        impact: 0.8, // Alto impacto na projeção
        examples: [
          `Última receita: ${lastTransaction.date}`,
          `Próxima receita esperada: ${avgInterval.toFixed(0)} dias`,
          `Valor médio: R$ ${(merchantTransactions.reduce((sum, t) => sum + t.amount, 0) / merchantTransactions.length).toFixed(2)}`,
        ],
      };
    }
  }

  return null;
}

function analyzeWeeklyPattern(
  transactions: Transaction[],
): HistoricalPattern | null {
  // Agrupar transações por dia da semana
  const transactionsByWeekday: { [key: number]: Transaction[] } = {};

  transactions.forEach((t) => {
    const dayOfWeek = new Date(t.date).getDay();
    if (!transactionsByWeekday[dayOfWeek]) {
      transactionsByWeekday[dayOfWeek] = [];
    }
    transactionsByWeekday[dayOfWeek].push(t);
  });

  // Calcular gastos médios por dia da semana
  const weekdayAverages: { [key: number]: number } = {};
  Object.entries(transactionsByWeekday).forEach(([day, dayTransactions]) => {
    const totalAmount = dayTransactions.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0,
    );
    weekdayAverages[parseInt(day)] = totalAmount / dayTransactions.length;
  });

  // Encontrar dias com padrões consistentes
  const weekdayNames = [
    "Domingo",
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
  ];
  const patterns: string[] = [];

  Object.entries(weekdayAverages).forEach(([day, avgAmount]) => {
    if (avgAmount > 50) {
      // Gastos significativos
      patterns.push(
        `${weekdayNames[parseInt(day)]}: R$ ${avgAmount.toFixed(2)}`,
      );
    }
  });

  if (patterns.length > 0) {
    return {
      patternType: "weekly",
      description: "Padrão de gastos por dia da semana identificado",
      confidence: "média",
      impact: 0.3,
      examples: patterns,
    };
  }

  return null;
}

function analyzeMonthlyPattern(
  transactions: Transaction[],
  currentDate: Date,
): HistoricalPattern | null {
  // Agrupar transações por mês
  const transactionsByMonth: { [key: string]: Transaction[] } = {};

  transactions.forEach((t) => {
    const transactionDate = new Date(t.date);
    const monthKey = `${transactionDate.getFullYear()}-${transactionDate.getMonth() + 1}`;
    if (!transactionsByMonth[monthKey]) {
      transactionsByMonth[monthKey] = [];
    }
    transactionsByMonth[monthKey].push(t);
  });

  const months = Object.keys(transactionsByMonth).sort();
  if (months.length < 3) return null;

  // Calcular gastos mensais
  const monthlyTotals: number[] = [];
  months.forEach((month) => {
    const monthTransactions = transactionsByMonth[month];
    const total = monthTransactions.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0,
    );
    monthlyTotals.push(total);
  });

  // Calcular tendência
  const firstHalf = monthlyTotals.slice(0, Math.ceil(monthlyTotals.length / 2));
  const secondHalf = monthlyTotals.slice(Math.floor(monthlyTotals.length / 2));

  const firstHalfAvg =
    firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
  const secondHalfAvg =
    secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

  const trendPercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

  let description = "Padrão mensal estável";
  let confidence: "alta" | "média" | "baixa" = "média";

  if (Math.abs(trendPercent) > 20) {
    description = `Tendência mensal ${trendPercent > 0 ? "crescente" : "decrescente"} de ${Math.abs(trendPercent).toFixed(1)}%`;
    confidence = "alta";
  }

  return {
    patternType: "monthly",
    description,
    confidence,
    impact: 0.5,
    examples: [
      `Média dos últimos meses: R$ ${secondHalfAvg.toFixed(2)}`,
      `Tendência: ${trendPercent > 0 ? "+" : ""}${trendPercent.toFixed(1)}%`,
      `Meses analisados: ${months.length}`,
    ],
  };
}

function analyzeSeasonalPattern(
  transactions: Transaction[],
): HistoricalPattern | null {
  // Agrupar transações por mês do ano
  const transactionsByMonth: { [key: number]: Transaction[] } = {};

  transactions.forEach((t) => {
    const month = new Date(t.date).getMonth() + 1;
    if (!transactionsByMonth[month]) {
      transactionsByMonth[month] = [];
    }
    transactionsByMonth[month].push(t);
  });

  // Calcular médias por mês
  const monthlyAverages: { [key: number]: number } = {};
  Object.entries(transactionsByMonth).forEach(([month, monthTransactions]) => {
    const totalAmount = monthTransactions.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0,
    );
    monthlyAverages[parseInt(month)] = totalAmount / monthTransactions.length;
  });

  // Identificar meses com padrões sazonais
  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const seasonalPatterns: string[] = [];
  const overallAverage =
    Object.values(monthlyAverages).reduce((sum, val) => sum + val, 0) /
    Object.values(monthlyAverages).length;

  Object.entries(monthlyAverages).forEach(([month, avgAmount]) => {
    const deviation = ((avgAmount - overallAverage) / overallAverage) * 100;
    if (Math.abs(deviation) > 30) {
      seasonalPatterns.push(
        `${monthNames[parseInt(month) - 1]}: ${deviation > 0 ? "+" : ""}${deviation.toFixed(1)}%`,
      );
    }
  });

  if (seasonalPatterns.length > 0) {
    return {
      patternType: "seasonal",
      description: "Padrões sazonais identificados",
      confidence: "média",
      impact: 0.4,
      examples: seasonalPatterns,
    };
  }

  return null;
}

function calculateSeasonalAdjustments(
  transactions: Transaction[],
  currentMonth: number,
): SeasonalAdjustment[] {
  const adjustments: SeasonalAdjustment[] = [];

  // Definir ajustes sazonais baseados em padrões comuns
  const seasonalFactors: { [key: number]: { factor: number; reason: string } } =
    {
      1: { factor: 1.1, reason: "Janeiro - gastos com férias e início do ano" },
      2: { factor: 0.9, reason: "Fevereiro - mês mais curto, menos gastos" },
      3: { factor: 1.0, reason: "Março - padrão normal" },
      4: { factor: 1.2, reason: "Abril - Páscoa e feriados" },
      5: { factor: 1.1, reason: "Maio - Dia das Mães" },
      6: { factor: 1.3, reason: "Junho - Festas Juninas" },
      7: { factor: 1.1, reason: "Julho - férias escolares" },
      8: { factor: 1.0, reason: "Agosto - padrão normal" },
      9: { factor: 1.1, reason: "Setembro - Dia dos Pais" },
      10: { factor: 1.0, reason: "Outubro - padrão normal" },
      11: { factor: 1.2, reason: "Novembro - Black Friday" },
      12: { factor: 1.4, reason: "Dezembro - Natal e fim de ano" },
    };

  // Aplicar ajuste para o mês atual
  const currentAdjustment = seasonalFactors[currentMonth];
  if (currentAdjustment) {
    adjustments.push({
      month: currentMonth,
      adjustmentFactor: currentAdjustment.factor,
      reason: currentAdjustment.reason,
      confidence: "média",
    });
  }

  return adjustments;
}

function generateBaseProjection(
  transactions: Transaction[],
  currentBalance: number,
  currentDate: Date,
): Projection {
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  // Calcular dias restantes no mês
  const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();
  const daysRemaining = lastDayOfMonth - currentDate.getDate() + 1;

  // Filtrar transações do mês atual
  const currentMonthTransactions = transactions.filter((t) => {
    const transactionDate = new Date(t.date);
    return (
      transactionDate.getMonth() + 1 === currentMonth &&
      transactionDate.getFullYear() === currentYear
    );
  });

  const currentMonthExpenses = currentMonthTransactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const currentMonthIncome = currentMonthTransactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  // Calcular dias já passados no mês
  const daysPassed = currentDate.getDate();

  // Calcular médias diárias
  const dailyExpenseAverage =
    daysPassed > 0 ? currentMonthExpenses / daysPassed : 0;
  const dailyIncomeAverage =
    daysPassed > 0 ? currentMonthIncome / daysPassed : 0;

  // Projetar gastos e receitas para o resto do mês
  const projectedExpenses = dailyExpenseAverage * daysRemaining;
  const projectedIncome = dailyIncomeAverage * daysRemaining;

  // Calcular saldo final projetado
  const projectedFinalBalance =
    currentBalance + projectedIncome - projectedExpenses;

  return {
    saldo_final_projetado: projectedFinalBalance,
    dias_restantes: daysRemaining,
    gasto_diario_medio: dailyExpenseAverage,
    receita_diaria_media: dailyIncomeAverage,
    impacto_reducao: [],
    confidence: "baixa", // Será ajustado posteriormente
  };
}

function applyPatternAdjustments(
  baseProjection: Projection,
  patterns: HistoricalPattern[],
  seasonalAdjustments: SeasonalAdjustment[],
): Projection {
  const adjustedProjection = { ...baseProjection };

  // Aplicar ajustes sazonais
  seasonalAdjustments.forEach((adjustment) => {
    adjustedProjection.gasto_diario_medio *= adjustment.adjustmentFactor;
    adjustedProjection.receita_diaria_media *= adjustment.adjustmentFactor;
  });

  // Aplicar ajustes baseados em padrões históricos
  patterns.forEach((pattern) => {
    if (pattern.patternType === "salary_cycle") {
      // Ajustar receita baseada no padrão de salário
      adjustedProjection.receita_diaria_media *= 1 + pattern.impact * 0.5;
    } else if (pattern.patternType === "monthly") {
      // Ajustar baseado na tendência mensal
      adjustedProjection.gasto_diario_medio *= 1 + pattern.impact * 0.3;
    }
  });

  // Recalcular saldo final
  adjustedProjection.saldo_final_projetado =
    adjustedProjection.receita_diaria_media *
      adjustedProjection.dias_restantes -
    adjustedProjection.gasto_diario_medio * adjustedProjection.dias_restantes;

  return adjustedProjection;
}

function calculateConfidenceFactors(
  transactions: Transaction[],
  patterns: HistoricalPattern[],
  currentDate: Date,
): ConfidenceFactor[] {
  const factors: ConfidenceFactor[] = [];

  // Fator: quantidade de dados
  if (transactions.length >= 30) {
    factors.push({
      factor: "Dados suficientes",
      impact: "positive",
      description: `${transactions.length} transações disponíveis`,
      weight: 0.3,
    });
  } else if (transactions.length < 10) {
    factors.push({
      factor: "Poucos dados",
      impact: "negative",
      description: `Apenas ${transactions.length} transações disponíveis`,
      weight: 0.4,
    });
  }

  // Fator: padrões identificados
  const highConfidencePatterns = patterns.filter(
    (p) => p.confidence === "alta",
  ).length;
  if (highConfidencePatterns > 0) {
    factors.push({
      factor: "Padrões identificados",
      impact: "positive",
      description: `${highConfidencePatterns} padrão(ões) de alta confiança`,
      weight: 0.3,
    });
  }

  // Fator: consistência temporal
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const currentMonthTransactions = transactions.filter((t) => {
    const transactionDate = new Date(t.date);
    return (
      transactionDate.getMonth() + 1 === currentMonth &&
      transactionDate.getFullYear() === currentYear
    );
  });

  if (currentMonthTransactions.length >= 10) {
    factors.push({
      factor: "Dados do mês atual",
      impact: "positive",
      description: `${currentMonthTransactions.length} transações no mês atual`,
      weight: 0.2,
    });
  }

  return factors;
}

function generateAlternativeScenarios(
  baseProjection: Projection,
  patterns: HistoricalPattern[],
  seasonalAdjustments: SeasonalAdjustment[],
): AlternativeScenario[] {
  const scenarios: AlternativeScenario[] = [];

  // Cenário otimista
  scenarios.push({
    name: "Cenário Otimista",
    description: "Redução de 20% nos gastos, receitas mantidas",
    projectedBalance:
      baseProjection.saldo_final_projetado +
      baseProjection.gasto_diario_medio * baseProjection.dias_restantes * 0.2,
    probability: 0.3,
    assumptions: [
      "Redução de gastos desnecessários",
      "Manutenção das receitas",
    ],
  });

  // Cenário pessimista
  scenarios.push({
    name: "Cenário Pessimista",
    description: "Aumento de 20% nos gastos, receitas mantidas",
    projectedBalance:
      baseProjection.saldo_final_projetado -
      baseProjection.gasto_diario_medio * baseProjection.dias_restantes * 0.2,
    probability: 0.2,
    assumptions: ["Aumento de gastos imprevistos", "Manutenção das receitas"],
  });

  // Cenário baseado em padrões históricos
  const salaryPattern = patterns.find((p) => p.patternType === "salary_cycle");
  if (salaryPattern) {
    scenarios.push({
      name: "Cenário com Próxima Receita",
      description: "Incluindo próxima receita esperada",
      projectedBalance:
        baseProjection.saldo_final_projetado +
        baseProjection.receita_diaria_media * 30, // Estimativa
      probability: 0.7,
      assumptions: [
        "Receita regular conforme padrão histórico",
        "Manutenção dos gastos atuais",
      ],
    });
  }

  return scenarios;
}

function calculateOverallConfidence(
  factors: ConfidenceFactor[],
): "alta" | "média" | "baixa" {
  if (factors.length === 0) return "baixa";

  let positiveWeight = 0;
  let negativeWeight = 0;
  let totalWeight = 0;

  factors.forEach((factor) => {
    totalWeight += factor.weight;
    if (factor.impact === "positive") {
      positiveWeight += factor.weight;
    } else if (factor.impact === "negative") {
      negativeWeight += factor.weight;
    }
  });

  const confidenceScore = (positiveWeight - negativeWeight) / totalWeight;

  if (confidenceScore > 0.3) return "alta";
  if (confidenceScore > -0.1) return "média";
  return "baixa";
}
