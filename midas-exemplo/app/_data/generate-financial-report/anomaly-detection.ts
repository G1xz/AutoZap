import { Anomaly, Transaction } from './types';
import { isSuspiciousTransaction } from './classification';

export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  
  return Math.sqrt(avgSquaredDiff);
}

export function detectAnomalies(
  transactions: Transaction[],
  monthlyIncome: number,
  _monthlyExpenses: number
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  
  if (transactions.length === 0) return anomalies;
  
  // Separar transações por tipo
  const expenseTransactions = transactions.filter(t => t.amount < 0);
  const incomeTransactions = transactions.filter(t => t.amount > 0);
  
  // Calcular estatísticas para despesas
  if (expenseTransactions.length > 0) {
    const expenseAmounts = expenseTransactions.map(t => Math.abs(t.amount));
    const expenseMean = expenseAmounts.reduce((sum, val) => sum + val, 0) / expenseAmounts.length;
    const expenseStdDev = calculateStandardDeviation(expenseAmounts);
    
    // Detectar despesas anômalas (> 3x desvio padrão ou > 20% da receita mensal)
    expenseTransactions.forEach(transaction => {
      const amount = Math.abs(transaction.amount);
      const isHighDeviation = amount > (expenseMean + 3 * expenseStdDev);
      const isHighPercentage = monthlyIncome > 0 && amount > (monthlyIncome * 0.2);
      const isSuspicious = isSuspiciousTransaction(transaction);
      
      if (isHighDeviation || isHighPercentage || isSuspicious) {
        let reason = '';
        let confidence: 'alta' | 'média' | 'baixa' = 'baixa';
        
        if (isSuspicious) {
          reason = 'transação suspeita (merchant ou valor atípico)';
          confidence = 'alta';
        } else if (isHighDeviation && isHighPercentage) {
          reason = 'valor muito acima da média mensal e alta porcentagem da receita';
          confidence = 'alta';
        } else if (isHighDeviation) {
          reason = 'valor muito acima da média mensal';
          confidence = 'média';
        } else if (isHighPercentage) {
          reason = 'valor representa alta porcentagem da receita mensal';
          confidence = 'média';
        }
        
        anomalies.push({
          id: transaction.id,
          merchant: transaction.merchant,
          amount: transaction.amount,
          reason,
          confidence,
          explanation: `Transação de R$ ${amount.toFixed(2)} no merchant "${transaction.merchant}" em ${transaction.date}`
        });
      }
    });
  }
  
  // Calcular estatísticas para receitas
  if (incomeTransactions.length > 0) {
    const incomeAmounts = incomeTransactions.map(t => t.amount);
    const incomeMean = incomeAmounts.reduce((sum, val) => sum + val, 0) / incomeAmounts.length;
    const incomeStdDev = calculateStandardDeviation(incomeAmounts);
    
    // Detectar receitas anômalas (> 3x desvio padrão)
    incomeTransactions.forEach(transaction => {
      const amount = transaction.amount;
      const isHighDeviation = amount > (incomeMean + 3 * incomeStdDev);
      const isSuspicious = isSuspiciousTransaction(transaction);
      
      if (isHighDeviation || isSuspicious) {
        let reason = '';
        let confidence: 'alta' | 'média' | 'baixa' = 'baixa';
        
        if (isSuspicious) {
          reason = 'transação suspeita (merchant ou valor atípico)';
          confidence = 'alta';
        } else if (isHighDeviation) {
          reason = 'valor muito acima da média mensal de receitas';
          confidence = 'média';
        }
        
        anomalies.push({
          id: transaction.id,
          merchant: transaction.merchant,
          amount: transaction.amount,
          reason,
          confidence,
          explanation: `Receita de R$ ${amount.toFixed(2)} no merchant "${transaction.merchant}" em ${transaction.date}`
        });
      }
    });
  }
  
  // Detectar inconsistências de classificação
  transactions.forEach(transaction => {
    const normalizedMerchant = transaction.merchant.toLowerCase().trim();
    
    // Verificar se salário aparece em despesas
    if (transaction.amount < 0 && 
        (normalizedMerchant.includes('salário') || 
         normalizedMerchant.includes('salary') || 
         normalizedMerchant.includes('salario'))) {
      anomalies.push({
        id: transaction.id,
        merchant: transaction.merchant,
        amount: transaction.amount,
        reason: 'salário classificado como despesa',
        confidence: 'alta',
        explanation: `Salário de R$ ${Math.abs(transaction.amount).toFixed(2)} foi classificado como despesa - possível erro de classificação`
      });
    }
    
    // Verificar se despesas aparecem em receitas
    if (transaction.amount > 0 && 
        (normalizedMerchant.includes('compra') || 
         normalizedMerchant.includes('purchase') || 
         normalizedMerchant.includes('pagamento') ||
         normalizedMerchant.includes('payment'))) {
      anomalies.push({
        id: transaction.id,
        merchant: transaction.merchant,
        amount: transaction.amount,
        reason: 'despesa classificada como receita',
        confidence: 'média',
        explanation: `Transação de compra/pagamento de R$ ${transaction.amount.toFixed(2)} foi classificada como receita - possível erro de classificação`
      });
    }
  });
  
  return anomalies;
}

export function detectTimeAnomalies(transactions: Transaction[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  
  // Agrupar transações por período do dia
  const transactionsByPeriod: { [key: string]: Transaction[] } = {
    'madrugada': [],
    'manhã': [],
    'tarde': [],
    'noite': []
  };
  
  transactions.forEach(transaction => {
    const hour = new Date(transaction.date).getHours();
    let period = '';
    
    if (hour >= 0 && hour < 6) period = 'madrugada';
    else if (hour >= 6 && hour < 12) period = 'manhã';
    else if (hour >= 12 && hour < 18) period = 'tarde';
    else period = 'noite';
    
    transactionsByPeriod[period].push(transaction);
  });
  
  // Detectar transações grandes na madrugada (atípico)
  const madrugadaTransactions = transactionsByPeriod['madrugada'];
  if (madrugadaTransactions.length > 0) {
    const madrugadaAmounts = madrugadaTransactions.map(t => Math.abs(t.amount));
    const madrugadaMean = madrugadaAmounts.reduce((sum, val) => sum + val, 0) / madrugadaAmounts.length;
    
    madrugadaTransactions.forEach(transaction => {
      const amount = Math.abs(transaction.amount);
      if (amount > madrugadaMean * 2 && amount > 100) { // Valores significativos
        anomalies.push({
          id: transaction.id,
          merchant: transaction.merchant,
          amount: transaction.amount,
          reason: 'transação de alto valor na madrugada',
          confidence: 'média',
          explanation: `Transação de R$ ${amount.toFixed(2)} às ${new Date(transaction.date).getHours()}:${new Date(transaction.date).getMinutes().toString().padStart(2, '0')} - período atípico para gastos grandes`
        });
      }
    });
  }
  
  return anomalies;
}
