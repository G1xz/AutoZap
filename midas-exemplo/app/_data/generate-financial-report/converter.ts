import { Transaction } from './types';
import { Transaction as PrismaTransaction } from '@prisma/client';

export function convertPrismaTransactionToReportFormat(prismaTransaction: PrismaTransaction): Transaction {
  // Determinar o amount baseado no tipo da transação
  let amount = Number(prismaTransaction.amount);
  
  // Se for EXPENSE, tornar negativo; se for DEPOSIT, manter positivo
  if (prismaTransaction.type === 'EXPENSE') {
    amount = -Math.abs(amount);
  } else if (prismaTransaction.type === 'DEPOSIT') {
    amount = Math.abs(amount);
  } else if (prismaTransaction.type === 'INVESTMENT') {
    // Investimentos são sempre positivos (dinheiro aplicado)
    amount = Math.abs(amount);
  }
  
  return {
    id: prismaTransaction.id,
    date: prismaTransaction.date.toISOString().split('T')[0], // YYYY-MM-DD format
    amount: amount,
    merchant: prismaTransaction.name, // O campo 'name' no Prisma corresponde ao 'merchant'
    category: prismaTransaction.category,
    payment_method: prismaTransaction.paymentMethod,
    transaction_type: prismaTransaction.type,
    notes: undefined // Prisma não tem campo notes, mas podemos adicionar depois
  };
}

export function convertPrismaTransactionsToReportFormat(prismaTransactions: PrismaTransaction[]): Transaction[] {
  return prismaTransactions.map(convertPrismaTransactionToReportFormat);
}
