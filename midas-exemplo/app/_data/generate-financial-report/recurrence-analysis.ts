import { RecurringTransaction, Transaction } from './types';
import { normalizeMerchantName } from './classification';

export function detectRecurringTransactions(transactions: Transaction[]): RecurringTransaction[] {
  const recurring: RecurringTransaction[] = [];
  
  if (transactions.length < 2) return recurring;
  
  // Agrupar transações por merchant normalizado
  const transactionsByMerchant: { [key: string]: Transaction[] } = {};
  
  transactions.forEach(transaction => {
    const normalizedMerchant = normalizeMerchantName(transaction.merchant);
    if (!transactionsByMerchant[normalizedMerchant]) {
      transactionsByMerchant[normalizedMerchant] = [];
    }
    transactionsByMerchant[normalizedMerchant].push(transaction);
  });
  
  // Analisar cada merchant com múltiplas transações
  Object.entries(transactionsByMerchant).forEach(([_merchant, merchantTransactions]) => {
    if (merchantTransactions.length < 2) return;
    
    // Ordenar por data
    merchantTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Calcular estatísticas de valor
    const amounts = merchantTransactions.map(t => Math.abs(t.amount));
    const averageAmount = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;
    
    // Verificar se os valores são similares (±10% da média)
    const isAmountConsistent = amounts.every(amount => 
      Math.abs(amount - averageAmount) <= averageAmount * 0.1
    );
    
    // Calcular intervalos entre transações
    const intervals: number[] = [];
    for (let i = 1; i < merchantTransactions.length; i++) {
      const prevDate = new Date(merchantTransactions[i - 1].date);
      const currDate = new Date(merchantTransactions[i].date);
      const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      intervals.push(diffDays);
    }
    
    // Calcular intervalo médio
    const averageInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    // Verificar se os intervalos são consistentes (±3 dias)
    const isIntervalConsistent = intervals.every(interval => 
      Math.abs(interval - averageInterval) <= 3
    );
    
    // Determinar confiança baseada na consistência
    let confidence: 'alta' | 'média' | 'baixa' = 'baixa';
    if (isAmountConsistent && isIntervalConsistent && merchantTransactions.length >= 3) {
      confidence = 'alta';
    } else if ((isAmountConsistent || isIntervalConsistent) && merchantTransactions.length >= 2) {
      confidence = 'média';
    }
    
    // Só incluir se tiver pelo menos média confiança
    if (confidence !== 'baixa') {
      const lastTransaction = merchantTransactions[merchantTransactions.length - 1];
      
      recurring.push({
        merchant: merchantTransactions[0].merchant, // Usar o nome original
        average_amount: averageAmount,
        frequency_days: Math.round(averageInterval),
        last_transaction: lastTransaction.date,
        total_transactions: merchantTransactions.length,
        confidence
      });
    }
  });
  
  return recurring;
}

export function analyzeRecurringPatterns(transactions: Transaction[]): {
  fixed_income: RecurringTransaction[];
  fixed_expenses: RecurringTransaction[];
  variable_expenses: RecurringTransaction[];
} {
  const recurring = detectRecurringTransactions(transactions);
  
  const fixedIncome: RecurringTransaction[] = [];
  const fixedExpenses: RecurringTransaction[] = [];
  const variableExpenses: RecurringTransaction[] = [];
  
  recurring.forEach(transaction => {
    // Determinar se é receita ou despesa baseado no merchant
    const normalizedMerchant = normalizeMerchantName(transaction.merchant);
    const isIncome = normalizedMerchant.includes('salário') || 
                    normalizedMerchant.includes('salary') || 
                    normalizedMerchant.includes('salario') ||
                    normalizedMerchant.includes('rendimento') ||
                    normalizedMerchant.includes('dividendos');
    
    if (isIncome) {
      fixedIncome.push(transaction);
    } else {
      // Classificar como despesa fixa ou variável baseado na frequência
      if (transaction.frequency_days <= 35 && transaction.confidence === 'alta') {
        fixedExpenses.push(transaction);
      } else {
        variableExpenses.push(transaction);
      }
    }
  });
  
  return {
    fixed_income: fixedIncome,
    fixed_expenses: fixedExpenses,
    variable_expenses: variableExpenses
  };
}

export function calculateRecurringImpact(recurring: RecurringTransaction[]): {
  monthly_total: number;
  yearly_projection: number;
  breakdown: Array<{
    merchant: string;
    monthly_amount: number;
    yearly_amount: number;
  }>;
} {
  const breakdown: Array<{
    merchant: string;
    monthly_amount: number;
    yearly_amount: number;
  }> = [];
  
  let monthlyTotal = 0;
  
  recurring.forEach(transaction => {
    // Calcular valor mensal baseado na frequência
    let monthlyAmount = 0;
    if (transaction.frequency_days <= 7) {
      // Semanal ou mais frequente
      monthlyAmount = transaction.average_amount * 4.33; // 4.33 semanas por mês
    } else if (transaction.frequency_days <= 35) {
      // Mensal
      monthlyAmount = transaction.average_amount;
    } else if (transaction.frequency_days <= 90) {
      // Trimestral
      monthlyAmount = transaction.average_amount / 3;
    } else {
      // Anual ou menos frequente
      monthlyAmount = transaction.average_amount / 12;
    }
    
    monthlyTotal += monthlyAmount;
    
    breakdown.push({
      merchant: transaction.merchant,
      monthly_amount: monthlyAmount,
      yearly_amount: monthlyAmount * 12
    });
  });
  
  return {
    monthly_total: monthlyTotal,
    yearly_projection: monthlyTotal * 12,
    breakdown
  };
}
