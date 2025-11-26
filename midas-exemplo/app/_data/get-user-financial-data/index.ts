import { db } from "@/app/_lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { TransactionType } from "@prisma/client";
import { ensureUserExists } from "@/app/_lib/token-tracking";

export interface UserFinancialData {
  totalBalance: number;
  monthlyExpenses: number;
  monthlyIncome: number;
  monthlyInvestments: number;
  expensesByCategory: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  recentTransactions: Array<{
    id: string;
    name: string;
    type: TransactionType;
    amount: number;
    category: string;
    paymentMethod: string;
    date: Date;
  }>;
  spendingTrends: {
    currentMonth: number;
    previousMonth: number;
    trend: "up" | "down" | "stable";
  };
  // Novos dados detalhados para análise transação por transação
  allTransactions: Array<{
    id: string;
    name: string;
    type: TransactionType;
    amount: number;
    category: string;
    paymentMethod: string;
    date: Date;
  }>;
  establishmentAnalysis: {
    topEstablishments: Array<{
      name: string;
      count: number;
      totalAmount: number;
      averageAmount: number;
      lastTransaction: Date;
    }>;
    establishmentFrequency: Array<{
      name: string;
      frequency: number; // vezes por mês
      totalSpent: number;
    }>;
  };
  spendingPatterns: {
    byDayOfWeek: Array<{
      day: string;
      amount: number;
      count: number;
    }>;
    byTimeOfDay: Array<{
      period: string;
      amount: number;
      count: number;
    }>;
    byPaymentMethod: Array<{
      method: string;
      amount: number;
      count: number;
      percentage: number;
    }>;
  };
  transactionInsights: {
    averageTransactionAmount: number;
    largestTransactions: Array<{
      name: string;
      amount: number;
      date: Date;
      category: string;
    }>;
    smallestTransactions: Array<{
      name: string;
      amount: number;
      date: Date;
      category: string;
    }>;
    recurringTransactions: Array<{
      name: string;
      count: number;
      totalAmount: number;
      averageAmount: number;
      frequency: string; // "diário", "semanal", "mensal"
    }>;
    unusualSpending: Array<{
      name: string;
      amount: number;
      date: Date;
      reason: string; // "valor alto", "categoria incomum", "estabelecimento novo"
    }>;
  };
  monthlyComparison: {
    currentMonth: {
      totalExpenses: number;
      totalIncome: number;
      transactionCount: number;
      averageTransactionAmount: number;
    };
    previousMonth: {
      totalExpenses: number;
      totalIncome: number;
      transactionCount: number;
      averageTransactionAmount: number;
    };
    changes: {
      expensesChange: number; // percentual
      incomeChange: number;
      transactionCountChange: number;
      averageAmountChange: number;
    };
  };
}

export const getUserFinancialData = async (): Promise<UserFinancialData> => {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    throw new Error("Unauthorized");
  }

  // Garantir que o usuário existe na tabela users
  const userId = await ensureUserExists(clerkUserId);

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Buscar todas as transações do usuário
  const allTransactionsRaw = await db.transaction.findMany({
    where: { userId },
    orderBy: { date: "desc" },
  });

  // Converter para formato padronizado
  const allTransactions = allTransactionsRaw.map((t) => ({
    id: t.id,
    name: t.name,
    type: t.type,
    amount: Number(t.amount),
    category: t.category,
    paymentMethod: t.paymentMethod,
    date: t.date,
  }));

  // Calcular saldo total
  const depositsTotal = allTransactions
    .filter((t) => t.type === "DEPOSIT")
    .reduce((sum, t) => sum + t.amount, 0);

  const expensesTotal = allTransactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + t.amount, 0);

  const investmentsTotal = allTransactions
    .filter((t) => t.type === "INVESTMENT")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalBalance = depositsTotal - expensesTotal - investmentsTotal;

  // Calcular dados do mês atual
  const currentMonthTransactions = allTransactions.filter(
    (t) => t.date >= currentMonthStart,
  );

  const monthlyExpenses = currentMonthTransactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyIncome = currentMonthTransactions
    .filter((t) => t.type === "DEPOSIT")
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyInvestments = currentMonthTransactions
    .filter((t) => t.type === "INVESTMENT")
    .reduce((sum, t) => sum + t.amount, 0);

  // Calcular gastos por categoria
  const categories = [
    "HOUSING",
    "TRANSPORTATION",
    "FOOD",
    "ENTERTAINMENT",
    "HEALTH",
    "UTILITY",
    "SALARY",
    "EDUCATION",
    "OTHER",
  ];
  const expensesByCategory = categories
    .map((category) => {
      const categoryExpenses = currentMonthTransactions
        .filter((t) => t.type === "EXPENSE" && t.category === category)
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        category,
        amount: categoryExpenses,
        percentage:
          monthlyExpenses > 0 ? (categoryExpenses / monthlyExpenses) * 100 : 0,
      };
    })
    .filter((item) => item.amount > 0);

  // Transações recentes (últimas 10)
  const recentTransactions = allTransactions.slice(0, 10);

  // Calcular tendências de gastos
  const previousMonthExpenses = allTransactions
    .filter(
      (t) =>
        t.type === "EXPENSE" &&
        t.date >= previousMonthStart &&
        t.date <= previousMonthEnd,
    )
    .reduce((sum, t) => sum + t.amount, 0);

  let trend: "up" | "down" | "stable" = "stable";
  if (monthlyExpenses > previousMonthExpenses * 1.05) {
    trend = "up";
  } else if (monthlyExpenses < previousMonthExpenses * 0.95) {
    trend = "down";
  }

  // === NOVA ANÁLISE DETALHADA ===

  // 1. Análise de Estabelecimentos
  const establishmentMap = new Map<
    string,
    {
      count: number;
      totalAmount: number;
      lastTransaction: Date;
      transactions: typeof allTransactions;
    }
  >();

  allTransactions.forEach((transaction) => {
    const name = transaction.name.toLowerCase().trim();
    if (!establishmentMap.has(name)) {
      establishmentMap.set(name, {
        count: 0,
        totalAmount: 0,
        lastTransaction: transaction.date,
        transactions: [],
      });
    }

    const establishment = establishmentMap.get(name)!;
    establishment.count++;
    establishment.totalAmount += transaction.amount;
    establishment.lastTransaction =
      transaction.date > establishment.lastTransaction
        ? transaction.date
        : establishment.lastTransaction;
    establishment.transactions.push(transaction);
  });

  const topEstablishments = Array.from(establishmentMap.entries())
    .map(([name, data]) => ({
      name,
      count: data.count,
      totalAmount: data.totalAmount,
      averageAmount: data.totalAmount / data.count,
      lastTransaction: data.lastTransaction,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 10);

  const establishmentFrequency = Array.from(establishmentMap.entries())
    .map(([name, data]) => ({
      name,
      frequency:
        data.count /
        Math.max(
          1,
          Math.ceil(
            (now.getTime() -
              Math.min(...allTransactions.map((t) => t.date.getTime()))) /
              (1000 * 60 * 60 * 24 * 30),
          ),
        ), // transações por mês
      totalSpent: data.totalAmount,
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);

  // 2. Padrões de Gastos
  const dayNames = [
    "Domingo",
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
  ];
  const byDayOfWeek = dayNames.map((day, index) => {
    const dayTransactions = allTransactions.filter(
      (t) => t.date.getDay() === index,
    );
    return {
      day,
      amount: dayTransactions.reduce((sum, t) => sum + t.amount, 0),
      count: dayTransactions.length,
    };
  });

  const byTimeOfDay = [
    { period: "Manhã (6h-12h)", start: 6, end: 12 },
    { period: "Tarde (12h-18h)", start: 12, end: 18 },
    { period: "Noite (18h-24h)", start: 18, end: 24 },
    { period: "Madrugada (0h-6h)", start: 0, end: 6 },
  ].map(({ period, start, end }) => {
    const periodTransactions = allTransactions.filter((t) => {
      const hour = t.date.getHours();
      return hour >= start && hour < end;
    });
    return {
      period,
      amount: periodTransactions.reduce((sum, t) => sum + t.amount, 0),
      count: periodTransactions.length,
    };
  });

  const paymentMethodMap = new Map<string, { amount: number; count: number }>();
  allTransactions.forEach((t) => {
    const method = t.paymentMethod;
    if (!paymentMethodMap.has(method)) {
      paymentMethodMap.set(method, { amount: 0, count: 0 });
    }
    const data = paymentMethodMap.get(method)!;
    data.amount += t.amount;
    data.count++;
  });

  const totalAmount = allTransactions.reduce((sum, t) => sum + t.amount, 0);
  const byPaymentMethod = Array.from(paymentMethodMap.entries()).map(
    ([method, data]) => ({
      method,
      amount: data.amount,
      count: data.count,
      percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
    }),
  );

  // 3. Insights de Transações
  const averageTransactionAmount =
    allTransactions.length > 0
      ? allTransactions.reduce((sum, t) => sum + t.amount, 0) /
        allTransactions.length
      : 0;

  const largestTransactions = allTransactions
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((t) => ({
      name: t.name,
      amount: t.amount,
      date: t.date,
      category: t.category,
    }));

  const smallestTransactions = allTransactions
    .sort((a, b) => a.amount - b.amount)
    .slice(0, 5)
    .map((t) => ({
      name: t.name,
      amount: t.amount,
      date: t.date,
      category: t.category,
    }));

  // Identificar transações recorrentes (mesmo nome aparecendo várias vezes)
  const recurringTransactions = Array.from(establishmentMap.entries())
    .filter(([_, data]) => data.count >= 3) // Pelo menos 3 vezes
    .map(([name, data]) => {
      const frequency =
        data.count >= 20 ? "diário" : data.count >= 8 ? "semanal" : "mensal";
      return {
        name,
        count: data.count,
        totalAmount: data.totalAmount,
        averageAmount: data.totalAmount / data.count,
        frequency,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Identificar gastos incomuns
  const unusualSpending = allTransactions
    .filter((t) => {
      const isHighValue = t.amount > averageTransactionAmount * 3; // 3x maior que a média
      const isUnusualCategory = t.category === "OTHER" && t.amount > 100;
      const isNewEstablishment =
        !establishmentMap.get(t.name.toLowerCase().trim()) ||
        establishmentMap.get(t.name.toLowerCase().trim())!.count === 1;

      return isHighValue || isUnusualCategory || isNewEstablishment;
    })
    .slice(0, 10)
    .map((t) => ({
      name: t.name,
      amount: t.amount,
      date: t.date,
      reason:
        t.amount > averageTransactionAmount * 3
          ? "valor alto"
          : t.category === "OTHER" && t.amount > 100
            ? "categoria incomum"
            : "estabelecimento novo",
    }));

  // 4. Comparação Mensal
  const previousMonthTransactions = allTransactions.filter(
    (t) => t.date >= previousMonthStart && t.date <= previousMonthEnd,
  );

  const currentMonthData = {
    totalExpenses: monthlyExpenses,
    totalIncome: monthlyIncome,
    transactionCount: currentMonthTransactions.length,
    averageTransactionAmount:
      currentMonthTransactions.length > 0
        ? currentMonthTransactions.reduce((sum, t) => sum + t.amount, 0) /
          currentMonthTransactions.length
        : 0,
  };

  const previousMonthData = {
    totalExpenses: previousMonthExpenses,
    totalIncome: previousMonthTransactions
      .filter((t) => t.type === "DEPOSIT")
      .reduce((sum, t) => sum + t.amount, 0),
    transactionCount: previousMonthTransactions.length,
    averageTransactionAmount:
      previousMonthTransactions.length > 0
        ? previousMonthTransactions.reduce((sum, t) => sum + t.amount, 0) /
          previousMonthTransactions.length
        : 0,
  };

  const changes = {
    expensesChange:
      previousMonthData.totalExpenses > 0
        ? ((currentMonthData.totalExpenses - previousMonthData.totalExpenses) /
            previousMonthData.totalExpenses) *
          100
        : 0,
    incomeChange:
      previousMonthData.totalIncome > 0
        ? ((currentMonthData.totalIncome - previousMonthData.totalIncome) /
            previousMonthData.totalIncome) *
          100
        : 0,
    transactionCountChange:
      previousMonthData.transactionCount > 0
        ? ((currentMonthData.transactionCount -
            previousMonthData.transactionCount) /
            previousMonthData.transactionCount) *
          100
        : 0,
    averageAmountChange:
      previousMonthData.averageTransactionAmount > 0
        ? ((currentMonthData.averageTransactionAmount -
            previousMonthData.averageTransactionAmount) /
            previousMonthData.averageTransactionAmount) *
          100
        : 0,
  };

  return {
    totalBalance,
    monthlyExpenses,
    monthlyIncome,
    monthlyInvestments,
    expensesByCategory,
    recentTransactions,
    spendingTrends: {
      currentMonth: monthlyExpenses,
      previousMonth: previousMonthExpenses,
      trend,
    },
    // Novos dados detalhados
    allTransactions,
    establishmentAnalysis: {
      topEstablishments,
      establishmentFrequency,
    },
    spendingPatterns: {
      byDayOfWeek,
      byTimeOfDay,
      byPaymentMethod,
    },
    transactionInsights: {
      averageTransactionAmount,
      largestTransactions,
      smallestTransactions,
      recurringTransactions,
      unusualSpending,
    },
    monthlyComparison: {
      currentMonth: currentMonthData,
      previousMonth: previousMonthData,
      changes,
    },
  };
};
