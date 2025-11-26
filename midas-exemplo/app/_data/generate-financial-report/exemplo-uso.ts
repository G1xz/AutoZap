// Exemplo de uso do Sistema de Relatórios Financeiros Melhorado
// Este arquivo demonstra como usar o novo sistema implementado

import { generateFinancialReport } from '@/app/_data/generate-financial-report';
import { Transaction } from '@/app/_data/generate-financial-report/types';

// Exemplo de transações baseado no caso de uso fornecido
const exemploTransacoes: Transaction[] = [
  {
    id: "1",
    date: "2025-09-08",
    amount: 10000,
    merchant: "Salário Empresa X",
    category: "SALARY",
    payment_method: "PIX",
    transaction_type: "DEPOSIT"
  },
  {
    id: "2",
    date: "2025-09-10",
    amount: -300,
    merchant: "Mercado",
    category: "FOOD",
    payment_method: "CASH",
    transaction_type: "EXPENSE"
  },
  {
    id: "3",
    date: "2025-09-11",
    amount: -6666,
    merchant: "Gacha",
    category: "OTHER",
    payment_method: "PIX",
    transaction_type: "EXPENSE"
  },
  {
    id: "4",
    date: "2025-09-12",
    amount: -150,
    merchant: "Netflix",
    category: "ENTERTAINMENT",
    payment_method: "CREDIT_CARD",
    transaction_type: "EXPENSE"
  },
  {
    id: "5",
    date: "2025-09-13",
    amount: -200,
    merchant: "Uber",
    category: "TRANSPORTATION",
    payment_method: "PIX",
    transaction_type: "EXPENSE"
  },
  {
    id: "6",
    date: "2025-09-14",
    amount: -500,
    merchant: "Farmácia",
    category: "HEALTH",
    payment_method: "DEBIT_CARD",
    transaction_type: "EXPENSE"
  },
  {
    id: "7",
    date: "2025-09-15",
    amount: 5000,
    merchant: "Freelance Projeto Y",
    category: "OTHER",
    payment_method: "PIX",
    transaction_type: "DEPOSIT"
  }
];

// Função para demonstrar o uso do sistema
export async function demonstrarSistemaRelatorios() {
  console.log('🚀 Demonstração do Sistema de Relatórios Financeiros Melhorado');
  console.log('=' .repeat(60));
  
  try {
    // Gerar relatório completo
    const relatorio = await generateFinancialReport(exemploTransacoes, 0);
    
    console.log('\n📊 RESUMO EXECUTIVO:');
    console.log(`- Saldo Total: R$ ${relatorio.summary.saldo_total.toFixed(2)}`);
    console.log(`- Receitas do Mês: R$ ${relatorio.summary.receitas_mes.toFixed(2)}`);
    console.log(`- Gastos do Mês: R$ ${relatorio.summary.gastos_mes.toFixed(2)}`);
    console.log(`- Total de Transações: ${relatorio.summary.total_transacoes}`);
    
    console.log('\n🏆 TOP 5 RECEITAS:');
    relatorio.top_receitas.slice(0, 5).forEach((receita, i) => {
      console.log(`${i + 1}. ${receita.merchant}: R$ ${receita.total.toFixed(2)} (${receita.count} vezes)`);
    });
    
    console.log('\n💸 TOP 5 DESPESAS:');
    relatorio.top_despesas.slice(0, 5).forEach((despesa, i) => {
      console.log(`${i + 1}. ${despesa.merchant}: R$ ${despesa.total.toFixed(2)} (${despesa.count} vezes)`);
    });
    
    console.log('\n📈 ANÁLISE POR CATEGORIAS:');
    relatorio.categories.slice(0, 5).forEach(cat => {
      console.log(`- ${cat.category}: R$ ${cat.total_amount.toFixed(2)} (${cat.percentage_of_total.toFixed(1)}%)`);
    });
    
    console.log('\n⚠️ ANOMALIAS DETECTADAS:');
    if (relatorio.anomalies.length > 0) {
      relatorio.anomalies.forEach(anomalia => {
        console.log(`- ${anomalia.merchant}: R$ ${Math.abs(anomalia.amount).toFixed(2)} - ${anomalia.reason} (${anomalia.confidence})`);
      });
    } else {
      console.log('- Nenhuma anomalia detectada');
    }
    
    console.log('\n🔄 TRANSAÇÕES RECORRENTES:');
    if (relatorio.recurring.length > 0) {
      relatorio.recurring.forEach(rec => {
        console.log(`- ${rec.merchant}: R$ ${rec.average_amount.toFixed(2)} a cada ${rec.frequency_days} dias (${rec.confidence})`);
      });
    } else {
      console.log('- Nenhuma transação recorrente detectada');
    }
    
    console.log('\n💡 INSIGHTS PRINCIPAIS:');
    relatorio.insights.forEach(insight => {
      console.log(`- ${insight.text} (${insight.confidence})`);
    });
    
    console.log('\n🔮 PROJEÇÕES:');
    console.log(`- Saldo Final Projetado: R$ ${relatorio.projections.saldo_final_projetado.toFixed(2)}`);
    console.log(`- Gasto Diário Médio: R$ ${relatorio.projections.gasto_diario_medio.toFixed(2)}`);
    console.log(`- Receita Diária Média: R$ ${relatorio.projections.receita_diaria_media.toFixed(2)}`);
    console.log(`- Confiança da Projeção: ${relatorio.projections.confidence}`);
    
    // Validações dos critérios de aceitação
    console.log('\n✅ VALIDAÇÃO DOS CRITÉRIOS DE ACEITAÇÃO:');
    
    // 1. Salário não deve aparecer em despesas
    const salarioEmDespesas = relatorio.top_despesas.find(d => 
      d.merchant.toLowerCase().includes('salário') || d.merchant.toLowerCase().includes('salary')
    );
    console.log(`1. Salário em despesas: ${salarioEmDespesas ? '❌ FALHOU' : '✅ PASSOU'}`);
    
    // 2. Soma das receitas ≈ receitas_mes
    const somaReceitas = relatorio.top_receitas.reduce((sum, r) => sum + r.total, 0);
    const diferencaReceitas = Math.abs(somaReceitas - relatorio.summary.receitas_mes);
    console.log(`2. Soma receitas ≈ receitas_mes: ${diferencaReceitas < 1 ? '✅ PASSOU' : '❌ FALHOU'} (diferença: R$ ${diferencaReceitas.toFixed(2)})`);
    
    // 3. Soma das despesas ≈ gastos_mes
    const somaDespesas = relatorio.top_despesas.reduce((sum, d) => sum + d.total, 0);
    const diferencaDespesas = Math.abs(somaDespesas - relatorio.summary.gastos_mes);
    console.log(`3. Soma despesas ≈ gastos_mes: ${diferencaDespesas < 1 ? '✅ PASSOU' : '❌ FALHOU'} (diferença: R$ ${diferencaDespesas.toFixed(2)})`);
    
    // 4. Cada anomalia tem explanation e confidence
    const anomaliasCompletas = relatorio.anomalies.every(a => a.explanation && a.confidence);
    console.log(`4. Anomalias com explanation e confidence: ${anomaliasCompletas ? '✅ PASSOU' : '❌ FALHOU'}`);
    
    console.log('\n🎉 Demonstração concluída com sucesso!');
    
    return relatorio;
    
  } catch (error) {
    console.error('❌ Erro ao gerar relatório:', error);
    throw error;
  }
}

// Função para testar casos específicos
export async function testarCasosEspecificos() {
  console.log('\n🧪 TESTANDO CASOS ESPECÍFICOS:');
  console.log('=' .repeat(40));
  
  // Teste 1: Salário classificado incorretamente
  const transacaoSalarioIncorreta: Transaction[] = [
    {
      id: "1",
      date: "2025-09-08",
      amount: -10000, // Amount negativo mas é salário
      merchant: "Salário Empresa X",
      category: "SALARY",
      payment_method: "PIX",
      transaction_type: "DEPOSIT"
    }
  ];
  
  const relatorio1 = await generateFinancialReport(transacaoSalarioIncorreta, 0);
  console.log('\nTeste 1 - Salário com amount negativo:');
  console.log(`- Classificado como receita: ${relatorio1.top_receitas.length > 0 ? '✅' : '❌'}`);
  console.log(`- Não aparece em despesas: ${relatorio1.top_despesas.length === 0 ? '✅' : '❌'}`);
  
  // Teste 2: Transação suspeita
  const transacaoSuspeita: Transaction[] = [
    {
      id: "1",
      date: "2025-09-08",
      amount: -6666,
      merchant: "Gacha Game",
      category: "OTHER",
      payment_method: "PIX",
      transaction_type: "EXPENSE"
    }
  ];
  
  const relatorio2 = await generateFinancialReport(transacaoSuspeita, 0);
  console.log('\nTeste 2 - Transação suspeita (Gacha):');
  console.log(`- Anomalia detectada: ${relatorio2.anomalies.length > 0 ? '✅' : '❌'}`);
  if (relatorio2.anomalies.length > 0) {
    console.log(`- Motivo: ${relatorio2.anomalies[0].reason}`);
  }
  
  console.log('\n✅ Testes específicos concluídos!');
}

// Executar demonstração se chamado diretamente
if (typeof window === 'undefined') {
  // Só executar no servidor
  demonstrarSistemaRelatorios()
    .then(() => testarCasosEspecificos())
    .catch(console.error);
}
