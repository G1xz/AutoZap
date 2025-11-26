import { Projection, Transaction, CategoryAnalysis } from './types';

export function generateProjections(
  transactions: Transaction[],
  currentBalance: number,
  currentDate: Date = new Date()
): Projection {
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  
  // Calcular dias restantes no mês
  const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();
  const daysRemaining = lastDayOfMonth - currentDate.getDate() + 1;
  
  // Calcular gastos e receitas do mês atual até agora
  const currentMonthTransactions = transactions.filter(t => {
    const transactionDate = new Date(t.date);
    return transactionDate.getMonth() + 1 === currentMonth && 
           transactionDate.getFullYear() === currentYear;
  });
  
  const currentMonthExpenses = currentMonthTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  const currentMonthIncome = currentMonthTransactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  
  // Calcular dias já passados no mês
  const daysPassed = currentDate.getDate();
  
  // Calcular médias diárias
  const dailyExpenseAverage = daysPassed > 0 ? currentMonthExpenses / daysPassed : 0;
  const dailyIncomeAverage = daysPassed > 0 ? currentMonthIncome / daysPassed : 0;
  
  // Projetar gastos e receitas para o resto do mês
  const projectedExpenses = dailyExpenseAverage * daysRemaining;
  const projectedIncome = dailyIncomeAverage * daysRemaining;
  
  // Calcular saldo final projetado
  const projectedFinalBalance = currentBalance + projectedIncome - projectedExpenses;
  
  // Determinar confiança baseada na quantidade de dados
  let confidence: 'alta' | 'média' | 'baixa' = 'baixa';
  if (daysPassed >= 15 && currentMonthTransactions.length >= 10) {
    confidence = 'alta';
  } else if (daysPassed >= 7 && currentMonthTransactions.length >= 5) {
    confidence = 'média';
  }
  
  return {
    saldo_final_projetado: projectedFinalBalance,
    dias_restantes: daysRemaining,
    gasto_diario_medio: dailyExpenseAverage,
    receita_diaria_media: dailyIncomeAverage,
    impacto_reducao: [], // Será preenchido pela função de análise de categorias
    confidence
  };
}

export function calculateReductionImpact(
  categories: CategoryAnalysis[],
  reductionPercentages: number[] = [10, 20, 30]
): Array<{
  categoria: string;
  reducao_percent: number;
  economia_projetada: number;
}> {
  const impacts: Array<{
    categoria: string;
    reducao_percent: number;
    economia_projetada: number;
  }> = [];
  
  // Filtrar apenas categorias de despesas (excluir receitas como SALARY)
  const expenseCategories = categories.filter(cat => 
    cat.category !== 'SALARY' && cat.total_amount > 0
  );
  
  // Ordenar por valor total (maiores despesas primeiro)
  expenseCategories.sort((a, b) => b.total_amount - a.total_amount);
  
  // Calcular impacto para as top 5 categorias
  const topCategories = expenseCategories.slice(0, 5);
  
  topCategories.forEach(category => {
    reductionPercentages.forEach(reductionPercent => {
      const economiaProjetada = (category.total_amount * reductionPercent) / 100;
      
      impacts.push({
        categoria: category.category,
        reducao_percent: reductionPercent,
        economia_projetada: economiaProjetada
      });
    });
  });
  
  return impacts;
}

export function generateProjectionInsights(projection: Projection): string[] {
  const insights: string[] = [];
  
  // Insight sobre saldo final
  if (projection.saldo_final_projetado < 0) {
    insights.push(`Projeção indica saldo negativo de R$ ${Math.abs(projection.saldo_final_projetado).toFixed(2)} no final do mês`);
  } else if (projection.saldo_final_projetado > projection.saldo_final_projetado * 0.1) {
    insights.push(`Projeção indica saldo positivo de R$ ${projection.saldo_final_projetado.toFixed(2)} no final do mês`);
  }
  
  // Insight sobre gastos diários
  if (projection.gasto_diario_medio > 100) {
    insights.push(`Você está gastando em média R$ ${projection.gasto_diario_medio.toFixed(2)} por dia`);
  }
  
  // Insight sobre receitas diárias
  if (projection.receita_diaria_media > 0) {
    insights.push(`Você está recebendo em média R$ ${projection.receita_diaria_media.toFixed(2)} por dia`);
  }
  
  // Insight sobre dias restantes
  if (projection.dias_restantes > 0) {
    const projectedDailyBalance = projection.receita_diaria_media - projection.gasto_diario_medio;
    if (projectedDailyBalance > 0) {
      insights.push(`Com ${projection.dias_restantes} dias restantes, você pode economizar R$ ${(projectedDailyBalance * projection.dias_restantes).toFixed(2)}`);
    } else if (projectedDailyBalance < 0) {
      insights.push(`Com ${projection.dias_restantes} dias restantes, você pode gastar mais R$ ${Math.abs(projectedDailyBalance * projection.dias_restantes).toFixed(2)}`);
    }
  }
  
  // Insight sobre confiança
  if (projection.confidence === 'baixa') {
    insights.push('Projeção com baixa confiança - poucos dados disponíveis');
  } else if (projection.confidence === 'alta') {
    insights.push('Projeção com alta confiança - baseada em dados consistentes');
  }
  
  return insights;
}

export function calculateSavingsPotential(
  categories: CategoryAnalysis[],
  targetSavings: number
): {
  achievable: boolean;
  required_reductions: Array<{
    categoria: string;
    reducao_percent: number;
    economia: number;
  }>;
  total_potential: number;
} {
  // Filtrar categorias de despesas
  const expenseCategories = categories.filter(cat => 
    cat.category !== 'SALARY' && cat.total_amount > 0
  );
  
  // Ordenar por valor total
  expenseCategories.sort((a, b) => b.total_amount - a.total_amount);
  
  const requiredReductions: Array<{
    categoria: string;
    reducao_percent: number;
    economia: number;
  }> = [];
  
  let totalPotential = 0;
  let remainingTarget = targetSavings;
  
  // Tentar atingir a meta reduzindo as maiores categorias
  for (const category of expenseCategories) {
    if (remainingTarget <= 0) break;
    
    // Calcular redução máxima possível (até 50% da categoria)
    const maxReduction = Math.min(50, (remainingTarget / category.total_amount) * 100);
    
    if (maxReduction > 0) {
      const economia = (category.total_amount * maxReduction) / 100;
      requiredReductions.push({
        categoria: category.category,
        reducao_percent: maxReduction,
        economia: economia
      });
      
      totalPotential += economia;
      remainingTarget -= economia;
    }
  }
  
  return {
    achievable: remainingTarget <= 0,
    required_reductions: requiredReductions,
    total_potential: totalPotential
  };
}
