import { ClassificationResult, MerchantHeuristics, Transaction } from './types';

export const MERCHANT_HEURISTICS: MerchantHeuristics = {
  income_keywords: [
    'salário', 'salary', 'salario', 'payroll', 'fatura recebida',
    'recebimento', 'depósito', 'deposit', 'transferência recebida',
    'transfer received', 'rendimento', 'dividendos', 'dividends',
    'bonus', 'bônus', 'comissão', 'commission', 'freelance',
    'freela', 'venda', 'sale', 'receita', 'income', 'pagamento recebido',
    'payment received', 'reembolso', 'refund', 'estorno'
  ],
  expense_keywords: [
    'compra', 'purchase', 'pagamento', 'payment', 'cobrança',
    'charge', 'débito', 'debit', 'saque', 'withdrawal',
    'transferência enviada', 'transfer sent', 'gasto', 'expense',
    'despesa', 'cobrança automática', 'automatic charge'
  ],
  suspicious_keywords: [
    'gacha', 'game', 'jogo', 'casino', 'aposta', 'bet',
    'loteria', 'lottery', 'bingo', 'poker', 'blackjack'
  ],
  refund_keywords: [
    'reembolso', 'refund', 'estorno', 'devolução', 'return',
    'cancelamento', 'cancellation', 'reversão', 'reversal'
  ]
};

export function normalizeMerchantName(merchant: string): string {
  return merchant.toLowerCase().trim();
}

export function classifyTransaction(transaction: Transaction): ClassificationResult {
  const normalizedMerchant = normalizeMerchantName(transaction.merchant);
  const amount = transaction.amount;
  const transactionType = transaction.transaction_type?.toUpperCase();
  
  let isIncome = false;
  let confidence: 'alta' | 'média' | 'baixa' = 'baixa';
  let reason = '';
  let conflictFlag = false;

  // 1. Verificar heurísticas de merchant (prioridade alta)
  const hasIncomeKeyword = MERCHANT_HEURISTICS.income_keywords.some(keyword => 
    normalizedMerchant.includes(keyword.toLowerCase())
  );
  
  const hasExpenseKeyword = MERCHANT_HEURISTICS.expense_keywords.some(keyword => 
    normalizedMerchant.includes(keyword.toLowerCase())
  );

  const hasRefundKeyword = MERCHANT_HEURISTICS.refund_keywords.some(keyword => 
    normalizedMerchant.includes(keyword.toLowerCase())
  );

  // 2. Verificar transaction_type se disponível
  const isDepositType = transactionType === 'DEPOSIT' || transactionType === 'INCOME';
  const isExpenseType = transactionType === 'EXPENSE' || transactionType === 'WITHDRAWAL';

  // 3. Aplicar regras de classificação
  if (hasIncomeKeyword) {
    isIncome = true;
    confidence = 'alta';
    reason = `Merchant contém palavra-chave de receita: "${transaction.merchant}"`;
    
    // Verificar conflito com amount negativo
    if (amount < 0) {
      conflictFlag = true;
      reason += ' (conflito: amount negativo mas merchant indica receita)';
    }
  } else if (hasRefundKeyword) {
    isIncome = true;
    confidence = 'média';
    reason = `Merchant contém palavra-chave de reembolso: "${transaction.merchant}"`;
  } else if (hasExpenseKeyword) {
    isIncome = false;
    confidence = 'alta';
    reason = `Merchant contém palavra-chave de despesa: "${transaction.merchant}"`;
    
    // Verificar conflito com amount positivo
    if (amount > 0) {
      conflictFlag = true;
      reason += ' (conflito: amount positivo mas merchant indica despesa)';
    }
  } else if (isDepositType) {
    isIncome = true;
    confidence = 'alta';
    reason = `Transaction type: ${transactionType}`;
    
    // Verificar conflito com amount negativo
    if (amount < 0) {
      conflictFlag = true;
      reason += ' (conflito: amount negativo mas type indica receita)';
    }
  } else if (isExpenseType) {
    isIncome = false;
    confidence = 'alta';
    reason = `Transaction type: ${transactionType}`;
    
    // Verificar conflito com amount positivo
    if (amount > 0) {
      conflictFlag = true;
      reason += ' (conflito: amount positivo mas type indica despesa)';
    }
  } else {
    // 4. Fallback para amount (regra padrão)
    isIncome = amount > 0;
    confidence = 'baixa';
    reason = `Classificação baseada no amount: ${amount > 0 ? 'positivo' : 'negativo'}`;
  }

  return {
    is_income: isIncome,
    confidence,
    reason,
    conflict_flag: conflictFlag
  };
}

export function isSuspiciousTransaction(transaction: Transaction): boolean {
  const normalizedMerchant = normalizeMerchantName(transaction.merchant);
  
  // Verificar palavras suspeitas
  const hasSuspiciousKeyword = MERCHANT_HEURISTICS.suspicious_keywords.some(keyword => 
    normalizedMerchant.includes(keyword.toLowerCase())
  );
  
  // Verificar valores suspeitos (padrões estranhos)
  const amount = Math.abs(transaction.amount);
  const hasSuspiciousAmount = 
    amount === 6666 || 
    amount === 666 || 
    amount === 7777 ||
    amount === 8888 ||
    amount === 9999 ||
    (amount > 10000 && amount % 1000 === 0); // Valores redondos muito altos
  
  return hasSuspiciousKeyword || hasSuspiciousAmount;
}

export function categorizeTransaction(transaction: Transaction, _classification: ClassificationResult): string {
  // Se já tem categoria definida, usar ela
  if (transaction.category && transaction.category !== 'OTHER') {
    return transaction.category;
  }
  
  const normalizedMerchant = normalizeMerchantName(transaction.merchant);
  
  // Mapear categorias baseado no merchant
  const categoryMappings: { [key: string]: string } = {
    'salário': 'SALARY',
    'salary': 'SALARY',
    'payroll': 'SALARY',
    'mercado': 'FOOD',
    'supermercado': 'FOOD',
    'restaurante': 'FOOD',
    'lanchonete': 'FOOD',
    'uber': 'TRANSPORTATION',
    'taxi': 'TRANSPORTATION',
    'gasolina': 'TRANSPORTATION',
    'combustível': 'TRANSPORTATION',
    'farmácia': 'HEALTH',
    'farmacia': 'HEALTH',
    'hospital': 'HEALTH',
    'clínica': 'HEALTH',
    'netflix': 'ENTERTAINMENT',
    'spotify': 'ENTERTAINMENT',
    'cinema': 'ENTERTAINMENT',
    'aluguel': 'HOUSING',
    'condomínio': 'HOUSING',
    'condominio': 'HOUSING',
    'energia': 'UTILITY',
    'água': 'UTILITY',
    'agua': 'UTILITY',
    'internet': 'UTILITY',
    'telefone': 'UTILITY',
    'curso': 'EDUCATION',
    'faculdade': 'EDUCATION',
    'universidade': 'EDUCATION',
    // Investimentos
    'cdb': 'INVESTMENT',
    'tesouro': 'INVESTMENT',
    'renda fixa': 'INVESTMENT',
    'renda variável': 'INVESTMENT',
    'fundo': 'INVESTMENT',
    'investimento': 'INVESTMENT',
    'investment': 'INVESTMENT',
    'ações': 'INVESTMENT',
    'acoes': 'INVESTMENT',
    'bolsa': 'INVESTMENT',
    'corretora': 'INVESTMENT',
    'broker': 'INVESTMENT',
    'poupança': 'INVESTMENT',
    'poupanca': 'INVESTMENT',
    'lci': 'INVESTMENT',
    'lca': 'INVESTMENT',
    'debêntures': 'INVESTMENT',
    'debentures': 'INVESTMENT'
  };
  
  // Procurar por palavras-chave no merchant
  for (const [keyword, category] of Object.entries(categoryMappings)) {
    if (normalizedMerchant.includes(keyword)) {
      return category;
    }
  }
  
  // Se não encontrou categoria específica, usar OTHER
  return 'OTHER';
}
