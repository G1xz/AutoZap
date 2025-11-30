/**
 * Helpers para otimizar queries do Prisma
 * Fornece selects otimizados para reduzir dados transferidos
 */

/**
 * Select mínimo para usuário (sem senha)
 */
export const userSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  updatedAt: true,
} as const

/**
 * Select mínimo para instância WhatsApp
 */
export const instanceSelect = {
  id: true,
  userId: true,
  name: true,
  phone: true,
  phoneId: true,
  status: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const

/**
 * Select para workflow sem dados completos
 */
export const workflowListSelect = {
  id: true,
  userId: true,
  instanceId: true,
  name: true,
  description: true,
  trigger: true,
  isActive: true,
  usesAI: true,
  isAIOnly: true,
  createdAt: true,
  updatedAt: true,
} as const

/**
 * Select mínimo para nó de workflow
 */
export const workflowNodeSelect = {
  id: true,
  workflowId: true,
  type: true,
  positionX: true,
  positionY: true,
  data: true,
} as const

/**
 * Select mínimo para conexão de workflow
 */
export const workflowConnectionSelect = {
  id: true,
  workflowId: true,
  sourceNodeId: true,
  targetNodeId: true,
  sourceHandle: true,
  targetHandle: true,
} as const

/**
 * Select mínimo para mensagem
 */
export const messageSelect = {
  id: true,
  instanceId: true,
  from: true,
  to: true,
  body: true,
  timestamp: true,
  isFromMe: true,
  isGroup: true,
  messageId: true,
  messageType: true,
  createdAt: true,
} as const

/**
 * Select mínimo para agendamento
 */
export const appointmentSelect = {
  id: true,
  userId: true,
  instanceId: true,
  contactNumber: true,
  contactName: true,
  date: true,
  endDate: true,
  duration: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const

/**
 * Select mínimo para serviço
 */
export const serviceSelect = {
  id: true,
  userId: true,
  name: true,
  description: true,
  price: true,
  imageUrl: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const

/**
 * Helper para paginação
 */
export function paginate<T>(
  page: number = 1,
  limit: number = 20
): { skip: number; take: number } {
  const skip = (page - 1) * limit
  const take = limit
  return { skip, take }
}

/**
 * Helper para ordenação
 */
export function orderBy<T extends string>(
  field: T,
  direction: 'asc' | 'desc' = 'desc'
): Record<T, 'asc' | 'desc'> {
  return { [field]: direction } as Record<T, 'asc' | 'desc'>
}

