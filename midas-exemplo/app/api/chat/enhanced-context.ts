import { generateFinancialReport } from "@/app/_data/generate-financial-report";
import { convertPrismaTransactionsToReportFormat } from "@/app/_data/generate-financial-report/converter";
import { db } from "@/app/_lib/prisma";
import { ensureUserExists } from "@/app/_lib/token-tracking";

export async function generateEnhancedFinancialContext(
  clerkUserId: string,
): Promise<string> {
  try {
    // Garantir que o usuário existe na tabela users
    const userId = await ensureUserExists(clerkUserId);

    // Buscar todas as transações do usuário
    const prismaTransactions = await db.transaction.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    });

    if (prismaTransactions.length === 0) {
      return "Nenhuma transação encontrada para análise.";
    }

    // Converter para formato do novo sistema
    const transactions =
      convertPrismaTransactionsToReportFormat(prismaTransactions);

    // Calcular saldo atual
    const currentBalance = prismaTransactions.reduce((balance, t) => {
      if (t.type === "DEPOSIT") return balance + Number(t.amount);
      if (t.type === "EXPENSE") return balance - Number(t.amount);
      if (t.type === "INVESTMENT") return balance - Number(t.amount);
      return balance;
    }, 0);

    // Gerar relatório financeiro melhorado com acesso ao histórico completo
    // Não filtrar por mês específico para dar acesso a todo o histórico
    const report = await generateFinancialReport(transactions, currentBalance, undefined);

    // Formatar contexto para o GPT
    const context = `
📊 RELATÓRIO FINANCEIRO HISTÓRICO COMPLETO - MIDAS AI
⚠️ IMPORTANTE: Este relatório inclui TODAS as transações históricas do usuário, não apenas do mês atual.

💰 RESUMO EXECUTIVO (HISTÓRICO COMPLETO):
- Saldo Total: R$ ${report.summary.saldo_total.toFixed(2)}
- Receitas Totais: R$ ${report.summary.receitas_mes.toFixed(2)}
- Gastos Totais: R$ ${report.summary.gastos_mes.toFixed(2)}
- Investimentos Totais: R$ ${report.summary.investimentos_mes.toFixed(2)}
- Total de Transações Históricas: ${report.summary.total_transacoes}

🏆 TOP 10 RECEITAS (HISTÓRICO COMPLETO):
${report.top_receitas
  .slice(0, 10)
  .map(
    (receita, i) =>
      `${i + 1}. ${receita.merchant}: R$ ${receita.total.toFixed(2)} (${receita.count} vezes, média R$ ${receita.average.toFixed(2)})`,
  )
  .join("\n")}

💸 TOP 10 DESPESAS (HISTÓRICO COMPLETO):
${report.top_despesas
  .slice(0, 10)
  .map(
    (despesa, i) =>
      `${i + 1}. ${despesa.merchant}: R$ ${despesa.total.toFixed(2)} (${despesa.count} vezes, média R$ ${despesa.average.toFixed(2)})`,
  )
  .join("\n")}

📈 ANÁLISE POR CATEGORIAS (HISTÓRICO COMPLETO):
${report.categories
  .slice(0, 8)
  .map(
    (cat) =>
      `- ${cat.category}: R$ ${cat.total_amount.toFixed(2)} (${cat.transaction_count} transações, ${cat.percentage_of_total.toFixed(1)}% do total)`,
  )
  .join("\n")}

📅 PADRÕES TEMPORAIS (HISTÓRICO COMPLETO):
POR DIA DA SEMANA:
${report.by_weekday
  .map(
    (day) =>
      `- ${day.day}: R$ ${day.total_amount.toFixed(2)} (${day.transaction_count} transações)`,
  )
  .join("\n")}

POR PERÍODO DO DIA:
${report.by_period
  .map(
    (period) =>
      `- ${period.period}: R$ ${period.total_amount.toFixed(2)} (${period.transaction_count} transações)`,
  )
  .join("\n")}

💳 POR MÉTODO DE PAGAMENTO (HISTÓRICO COMPLETO):
${report.by_payment_method
  .map(
    (method) =>
      `- ${method.method}: R$ ${method.total_amount.toFixed(2)} (${method.transaction_count} transações, ${method.percentage_of_total.toFixed(1)}%)`,
  )
  .join("\n")}

🔄 TRANSAÇÕES RECORRENTES (HISTÓRICO COMPLETO):
${report.recurring
  .slice(0, 5)
  .map(
    (rec) =>
      `- ${rec.merchant}: R$ ${rec.average_amount.toFixed(2)} a cada ${rec.frequency_days} dias (${rec.confidence} confiança)`,
  )
  .join("\n")}

⚠️ ANOMALIAS DETECTADAS (HISTÓRICO COMPLETO):
${report.anomalies
  .slice(0, 5)
  .map(
    (anomaly) =>
      `- ${anomaly.merchant}: R$ ${Math.abs(anomaly.amount).toFixed(2)} - ${anomaly.reason} (${anomaly.confidence} confiança)`,
  )
  .join("\n")}

🚨 ALERTAS DE CATEGORIA (HISTÓRICO COMPLETO):
${report.categoryAlerts
  .slice(0, 3)
  .map(
    (alert) =>
      `- ${alert.category}: ${alert.message} (${alert.severity} severidade)`,
  )
  .join("\n")}

📊 PADRÕES DE GASTOS (HISTÓRICO COMPLETO):
${report.spendingPatterns
  .slice(0, 5)
  .map(
    (pattern) =>
      `- ${pattern.merchant}: ${pattern.frequency.toFixed(1)}x/mês, R$ ${pattern.averageAmount.toFixed(2)} médio, tendência ${pattern.trend}`,
  )
  .join("\n")}

📊 ANÁLISE HISTÓRICA COMPLETA:
⚠️ NOTA: Como este é um relatório histórico completo, não há comparação mensal específica.
Todos os dados acima representam o histórico completo de transações do usuário.

🔮 PROJEÇÕES INTELIGENTES:
- Saldo Final Projetado: R$ ${report.projections.saldo_final_projetado.toFixed(2)}
- Gasto Diário Médio: R$ ${report.projections.gasto_diario_medio.toFixed(2)}
- Receita Diária Média: R$ ${report.projections.receita_diaria_media.toFixed(2)}
- Dias Restantes: ${report.projections.dias_restantes}
- Confiança da Projeção: ${report.projections.confidence}

${
  report.projections.historicalPatterns
    ? `
📈 PADRÕES HISTÓRICOS IDENTIFICADOS:
${report.projections.historicalPatterns
  .slice(0, 3)
  .map(
    (pattern) =>
      `- ${pattern.patternType}: ${pattern.description} (${pattern.confidence} confiança)`,
  )
  .join("\n")}
`
    : ""
}

${
  report.projections.alternativeScenarios
    ? `
🎯 CENÁRIOS ALTERNATIVOS:
${report.projections.alternativeScenarios
  .slice(0, 2)
  .map(
    (scenario) =>
      `- ${scenario.name}: R$ ${scenario.projectedBalance.toFixed(2)} (${(scenario.probability * 100).toFixed(0)}% probabilidade)`,
  )
  .join("\n")}
`
    : ""
}

💡 INSIGHTS PRINCIPAIS (HISTÓRICO COMPLETO):
${report.insights
  .map((insight) => `- ${insight.text} (${insight.confidence} confiança)`)
  .join("\n")}

📋 TRANSAÇÕES INDIVIDUAIS (HISTÓRICO COMPLETO):
${report.raw_transactions
  .slice(0, 50) // Limitar a 50 transações para não sobrecarregar o contexto
  .map((t, i) => 
    `${i + 1}. ${t.date} - ${t.merchant} - R$ ${Math.abs(t.amount).toFixed(2)} - ${t.category || 'N/A'} - ${t.payment_method} - ${t.transaction_type || 'N/A'}`
  )
  .join("\n")}

📝 IMPORTANTE: Este relatório fornece acesso completo ao histórico financeiro do usuário.
O Midas pode responder perguntas sobre qualquer período histórico, não apenas o mês atual.
Cada transação inclui: data, nome/estabelecimento, valor, categoria, método de pagamento e tipo.
`;

    return context;
  } catch (error) {
    console.error("Error generating enhanced financial context:", error);
    return "Erro ao gerar contexto financeiro melhorado.";
  }
}
