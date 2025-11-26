import { MonthlyComparison, Transaction } from './types';

export function compareMonths(
  currentMonthTransactions: Transaction[],
  previousMonthTransactions: Transaction[]
): MonthlyComparison {
  // Calcular dados do mês atual
  const currentIncome = currentMonthTransactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const currentExpenses = currentMonthTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  const currentTransactions = currentMonthTransactions.length;
  const currentAverage = currentTransactions > 0 ? 
    (currentIncome + currentExpenses) / currentTransactions : 0;
  
  // Calcular dados do mês anterior
  const previousIncome = previousMonthTransactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const previousExpenses = previousMonthTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  const previousTransactions = previousMonthTransactions.length;
  const previousAverage = previousTransactions > 0 ? 
    (previousIncome + previousExpenses) / previousTransactions : 0;
  
  // Calcular variações percentuais
  const calculateVariation = (current: number, previous: number): number | null => {
    if (previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };
  
  const incomeVariation = calculateVariation(currentIncome, previousIncome);
  const expensesVariation = calculateVariation(currentExpenses, previousExpenses);
  const transactionsVariation = calculateVariation(currentTransactions, previousTransactions);
  const averageVariation = calculateVariation(currentAverage, previousAverage);
  
  // Gerar notas explicativas
  const notes: string[] = [];
  
  if (previousIncome === 0 && currentIncome > 0) {
    notes.push('Mês anterior não teve receitas registradas');
  }
  
  if (previousExpenses === 0 && currentExpenses > 0) {
    notes.push('Mês anterior não teve despesas registradas');
  }
  
  if (previousTransactions === 0 && currentTransactions > 0) {
    notes.push('Mês anterior não teve transações registradas');
  }
  
  // Adicionar insights sobre variações significativas
  if (incomeVariation !== null) {
    if (incomeVariation > 50) {
      notes.push(`Receitas aumentaram significativamente (+${incomeVariation.toFixed(1)}%)`);
    } else if (incomeVariation < -50) {
      notes.push(`Receitas diminuíram significativamente (${incomeVariation.toFixed(1)}%)`);
    }
  }
  
  if (expensesVariation !== null) {
    if (expensesVariation > 50) {
      notes.push(`Despesas aumentaram significativamente (+${expensesVariation.toFixed(1)}%)`);
    } else if (expensesVariation < -50) {
      notes.push(`Despesas diminuíram significativamente (${expensesVariation.toFixed(1)}%)`);
    }
  }
  
  return {
    current_month: {
      receitas: currentIncome,
      despesas: currentExpenses,
      transacoes: currentTransactions,
      media_por_transacao: currentAverage
    },
    previous_month: {
      receitas: previousIncome,
      despesas: previousExpenses,
      transacoes: previousTransactions,
      media_por_transacao: previousAverage
    },
    variation: {
      receitas_percent: incomeVariation,
      despesas_percent: expensesVariation,
      transacoes_percent: transactionsVariation,
      media_percent: averageVariation
    },
    notes: notes.length > 0 ? notes : undefined
  };
}

export function getMonthDateRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // Último dia do mês
  
  return { start, end };
}

export function filterTransactionsByMonth(
  transactions: Transaction[],
  year: number,
  month: number
): Transaction[] {
  const { start, end } = getMonthDateRange(year, month);
  
  return transactions.filter(transaction => {
    const transactionDate = new Date(transaction.date);
    return transactionDate >= start && transactionDate <= end;
  });
}

export function generateComparisonInsights(comparison: MonthlyComparison): string[] {
  const insights: string[] = [];
  
  // Insights sobre receitas
  if (comparison.variation.receitas_percent !== null) {
    const variation = comparison.variation.receitas_percent;
    if (variation > 0) {
      insights.push(`Suas receitas aumentaram ${variation.toFixed(1)}% em relação ao mês anterior`);
    } else if (variation < 0) {
      insights.push(`Suas receitas diminuíram ${Math.abs(variation).toFixed(1)}% em relação ao mês anterior`);
    }
  } else if (comparison.previous_month.receitas === 0 && comparison.current_month.receitas > 0) {
    insights.push('Você começou a registrar receitas este mês');
  }
  
  // Insights sobre despesas
  if (comparison.variation.despesas_percent !== null) {
    const variation = comparison.variation.despesas_percent;
    if (variation > 0) {
      insights.push(`Suas despesas aumentaram ${variation.toFixed(1)}% em relação ao mês anterior`);
    } else if (variation < 0) {
      insights.push(`Suas despesas diminuíram ${Math.abs(variation).toFixed(1)}% em relação ao mês anterior`);
    }
  } else if (comparison.previous_month.despesas === 0 && comparison.current_month.despesas > 0) {
    insights.push('Você começou a registrar despesas este mês');
  }
  
  // Insights sobre número de transações
  if (comparison.variation.transacoes_percent !== null) {
    const variation = comparison.variation.transacoes_percent;
    if (variation > 0) {
      insights.push(`Você fez ${variation.toFixed(1)}% mais transações este mês`);
    } else if (variation < 0) {
      insights.push(`Você fez ${Math.abs(variation).toFixed(1)}% menos transações este mês`);
    }
  }
  
  // Insights sobre saldo
  const currentBalance = comparison.current_month.receitas - comparison.current_month.despesas;
  const previousBalance = comparison.previous_month.receitas - comparison.previous_month.despesas;
  
  if (previousBalance !== 0) {
    const balanceVariation = ((currentBalance - previousBalance) / Math.abs(previousBalance)) * 100;
    if (balanceVariation > 0) {
      insights.push(`Seu saldo melhorou ${balanceVariation.toFixed(1)}% em relação ao mês anterior`);
    } else if (balanceVariation < 0) {
      insights.push(`Seu saldo piorou ${Math.abs(balanceVariation).toFixed(1)}% em relação ao mês anterior`);
    }
  }
  
  return insights;
}
