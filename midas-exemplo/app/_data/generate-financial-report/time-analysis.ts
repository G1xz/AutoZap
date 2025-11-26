import { DayOfWeekAnalysis, TimePeriodAnalysis, PaymentMethodAnalysis, Transaction } from './types';

export function analyzeByDayOfWeek(transactions: Transaction[]): DayOfWeekAnalysis[] {
  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const dayData: { [key: string]: { total: number; count: number } } = {};
  
  // Inicializar dados para cada dia
  dayNames.forEach(day => {
    dayData[day] = { total: 0, count: 0 };
  });
  
  // Processar transações
  transactions.forEach(transaction => {
    const date = new Date(transaction.date);
    const dayName = dayNames[date.getDay()];
    const amount = Math.abs(transaction.amount);
    
    dayData[dayName].total += amount;
    dayData[dayName].count += 1;
  });
  
  // Converter para array de análise
  return dayNames.map(day => ({
    day,
    total_amount: dayData[day].total,
    transaction_count: dayData[day].count,
    average_amount: dayData[day].count > 0 ? dayData[day].total / dayData[day].count : 0
  }));
}

export function analyzeByTimePeriod(transactions: Transaction[]): TimePeriodAnalysis[] {
  const periods = [
    { name: 'Madrugada', start: 0, end: 6 },
    { name: 'Manhã', start: 6, end: 12 },
    { name: 'Tarde', start: 12, end: 18 },
    { name: 'Noite', start: 18, end: 24 }
  ];
  
  const periodData: { [key: string]: { total: number; count: number } } = {};
  
  // Inicializar dados para cada período
  periods.forEach(period => {
    periodData[period.name] = { total: 0, count: 0 };
  });
  
  // Processar transações
  transactions.forEach(transaction => {
    const date = new Date(transaction.date);
    const hour = date.getHours();
    const amount = Math.abs(transaction.amount);
    
    // Determinar período
    let periodName = '';
    for (const period of periods) {
      if (hour >= period.start && hour < period.end) {
        periodName = period.name;
        break;
      }
    }
    
    if (periodName) {
      periodData[periodName].total += amount;
      periodData[periodName].count += 1;
    }
  });
  
  // Converter para array de análise
  return periods.map(period => ({
    period: period.name,
    total_amount: periodData[period.name].total,
    transaction_count: periodData[period.name].count,
    average_amount: periodData[period.name].count > 0 ? 
      periodData[period.name].total / periodData[period.name].count : 0
  }));
}

export function analyzeByPaymentMethod(transactions: Transaction[]): PaymentMethodAnalysis[] {
  const methodData: { [key: string]: { total: number; count: number } } = {};
  
  // Processar transações
  transactions.forEach(transaction => {
    const method = transaction.payment_method;
    const amount = Math.abs(transaction.amount);
    
    if (!methodData[method]) {
      methodData[method] = { total: 0, count: 0 };
    }
    
    methodData[method].total += amount;
    methodData[method].count += 1;
  });
  
  // Calcular totais para percentuais
  const totalAmount = Object.values(methodData).reduce((sum, data) => sum + data.total, 0);
  const totalTransactions = Object.values(methodData).reduce((sum, data) => sum + data.count, 0);
  
  // Converter para array de análise
  return Object.entries(methodData).map(([method, data]) => ({
    method,
    total_amount: data.total,
    transaction_count: data.count,
    percentage_of_total: totalAmount > 0 ? (data.total / totalAmount) * 100 : 0,
    percentage_of_transactions: totalTransactions > 0 ? (data.count / totalTransactions) * 100 : 0
  }));
}

export function detectTimePatterns(
  dayOfWeekAnalysis: DayOfWeekAnalysis[],
  timePeriodAnalysis: TimePeriodAnalysis[]
): {
  highest_spending_day: string;
  lowest_spending_day: string;
  highest_spending_period: string;
  lowest_spending_period: string;
  weekend_vs_weekday: {
    weekend_total: number;
    weekday_total: number;
    weekend_count: number;
    weekday_count: number;
  };
  insights: string[];
} {
  // Encontrar dias com maior e menor gasto
  const sortedDays = [...dayOfWeekAnalysis].sort((a, b) => b.total_amount - a.total_amount);
  const highestSpendingDay = sortedDays[0]?.day || '';
  const lowestSpendingDay = sortedDays[sortedDays.length - 1]?.day || '';
  
  // Encontrar períodos com maior e menor gasto
  const sortedPeriods = [...timePeriodAnalysis].sort((a, b) => b.total_amount - a.total_amount);
  const highestSpendingPeriod = sortedPeriods[0]?.period || '';
  const lowestSpendingPeriod = sortedPeriods[sortedPeriods.length - 1]?.period || '';
  
  // Calcular weekend vs weekday
  const weekendDays = ['Sábado', 'Domingo'];
  const weekendData = dayOfWeekAnalysis.filter(day => weekendDays.includes(day.day));
  const weekdayData = dayOfWeekAnalysis.filter(day => !weekendDays.includes(day.day));
  
  const weekendTotal = weekendData.reduce((sum, day) => sum + day.total_amount, 0);
  const weekdayTotal = weekdayData.reduce((sum, day) => sum + day.total_amount, 0);
  const weekendCount = weekendData.reduce((sum, day) => sum + day.transaction_count, 0);
  const weekdayCount = weekdayData.reduce((sum, day) => sum + day.transaction_count, 0);
  
  // Gerar insights
  const insights: string[] = [];
  
  if (highestSpendingDay && lowestSpendingDay) {
    const highestDayData = dayOfWeekAnalysis.find(d => d.day === highestSpendingDay);
    const lowestDayData = dayOfWeekAnalysis.find(d => d.day === lowestSpendingDay);
    
    if (highestDayData && lowestDayData && highestDayData.total_amount > 0) {
      const ratio = highestDayData.total_amount / lowestDayData.total_amount;
      if (ratio > 2) {
        insights.push(`Você gasta ${ratio.toFixed(1)}x mais nas ${highestSpendingDay}s do que nas ${lowestSpendingDay}s`);
      }
    }
  }
  
  if (highestSpendingPeriod && lowestSpendingPeriod) {
    const highestPeriodData = timePeriodAnalysis.find(p => p.period === highestSpendingPeriod);
    const lowestPeriodData = timePeriodAnalysis.find(p => p.period === lowestSpendingPeriod);
    
    if (highestPeriodData && lowestPeriodData && highestPeriodData.total_amount > 0) {
      const ratio = highestPeriodData.total_amount / lowestPeriodData.total_amount;
      if (ratio > 2) {
        insights.push(`Você gasta ${ratio.toFixed(1)}x mais na ${highestSpendingPeriod} do que na ${lowestSpendingPeriod}`);
      }
    }
  }
  
  // Verificar se há gastos altos na madrugada
  const madrugadaData = timePeriodAnalysis.find(p => p.period === 'Madrugada');
  if (madrugadaData && madrugadaData.total_amount > 0) {
    const totalAmount = timePeriodAnalysis.reduce((sum, p) => sum + p.total_amount, 0);
    const madrugadaPercentage = (madrugadaData.total_amount / totalAmount) * 100;
    
    if (madrugadaPercentage > 10) {
      insights.push(`Você gasta ${madrugadaPercentage.toFixed(1)}% do seu dinheiro na madrugada - período atípico para gastos`);
    }
  }
  
  return {
    highest_spending_day: highestSpendingDay,
    lowest_spending_day: lowestSpendingDay,
    highest_spending_period: highestSpendingPeriod,
    lowest_spending_period: lowestSpendingPeriod,
    weekend_vs_weekday: {
      weekend_total: weekendTotal,
      weekday_total: weekdayTotal,
      weekend_count: weekendCount,
      weekday_count: weekdayCount
    },
    insights
  };
}
