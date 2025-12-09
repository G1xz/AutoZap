/**
 * Sistema de Planos e Pontos
 * 
 * Regras:
 * - 1 dólar = 1000 pontos
 * - Cada plano tem uma porcentagem que fica para o admin
 * - O restante vira pontos para o cliente
 */

import { prisma } from './prisma'

export interface PlanConfig {
  name: string
  displayName: string
  price: number // Preço em R$
  adminPercentage: number // Porcentagem que fica para o admin (0.30 = 30%)
}

// Configuração dos planos
export const PLAN_CONFIGS: PlanConfig[] = [
  {
    name: 'basico',
    displayName: 'Básico',
    price: 15.00,
    adminPercentage: 0.30, // 30% para admin, 70% em pontos
  },
  {
    name: 'pro',
    displayName: 'Pro',
    price: 30.00,
    adminPercentage: 0.25, // 25% para admin, 75% em pontos
  },
  {
    name: 'business',
    displayName: 'Business',
    price: 60.00,
    adminPercentage: 0.20, // 20% para admin, 80% em pontos
  },
  {
    name: 'enterprise',
    displayName: 'Enterprise',
    price: 120.00,
    adminPercentage: 0.15, // 15% para admin, 85% em pontos
  },
]

// Taxa de conversão: 1 dólar = 1000 pontos
// Precisamos converter R$ para dólares primeiro
// Taxa de câmbio configurável via variável de ambiente
const EXCHANGE_RATE = parseFloat(process.env.EXCHANGE_RATE || '5.0') // 1 USD = X BRL (padrão: 5.0)
const POINTS_PER_DOLLAR = 1000 // 1 USD = 1000 pontos

/**
 * Calcula quantos pontos o cliente recebe baseado no plano
 */
export function calculatePointsFromPlan(planConfig: PlanConfig): number {
  // Converte preço de R$ para USD
  const priceInUSD = planConfig.price / EXCHANGE_RATE
  
  // Calcula quanto fica para o cliente (100% - adminPercentage)
  const clientPercentage = 1 - planConfig.adminPercentage
  
  // Calcula pontos (1 USD = 1000 pontos)
  const points = Math.floor(priceInUSD * clientPercentage * POINTS_PER_DOLLAR)
  
  return points
}

/**
 * Calcula quanto o admin recebe em R$ baseado no plano
 */
export function calculateAdminRevenue(planConfig: PlanConfig): number {
  return planConfig.price * planConfig.adminPercentage
}

/**
 * Inicializa os planos no banco de dados
 */
export async function initializePlans(): Promise<void> {
  for (const config of PLAN_CONFIGS) {
    const pointsAmount = calculatePointsFromPlan(config)
    
    await prisma.plan.upsert({
      where: { name: config.name },
      update: {
        displayName: config.displayName,
        price: config.price,
        adminPercentage: config.adminPercentage,
        pointsAmount,
      },
      create: {
        name: config.name,
        displayName: config.displayName,
        price: config.price,
        adminPercentage: config.adminPercentage,
        pointsAmount,
        isActive: true,
      },
    })
  }
}

/**
 * Busca todos os planos ativos
 */
export async function getActivePlans() {
  return await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
  })
}

/**
 * Busca um plano por nome
 */
export async function getPlanByName(name: string) {
  return await prisma.plan.findUnique({
    where: { name },
  })
}

/**
 * Assina um plano para um usuário
 */
export async function subscribeUserToPlan(
  userId: string,
  planId: string,
  pricePaid: number
): Promise<{ subscription: any; pointsAdded: number }> {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
  })

  if (!plan) {
    throw new Error('Plano não encontrado')
  }

  if (!plan.isActive) {
    throw new Error('Plano não está ativo')
  }

  // Calcula data de renovação (30 dias)
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 30)

  // Cria assinatura
  const subscription = await prisma.planSubscription.create({
    data: {
      userId,
      planId: plan.id,
      status: 'active',
      startDate: new Date(),
      endDate,
      pointsReceived: plan.pointsAmount,
      pricePaid: pricePaid,
    },
  })

  // Atualiza pontos do usuário
  await prisma.user.update({
    where: { id: userId },
    data: {
      planName: plan.displayName,
      pointsAvailable: {
        increment: plan.pointsAmount,
      },
      planRenewalDate: endDate,
    },
  })

  return {
    subscription,
    pointsAdded: plan.pointsAmount,
  }
}

