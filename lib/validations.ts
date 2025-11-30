/**
 * Schemas de validação Zod reutilizáveis
 * Centraliza todas as validações do sistema
 */

import { z } from 'zod'

/**
 * Validação de email
 */
export const emailSchema = z.string().email('Email inválido')

/**
 * Validação de senha
 */
export const passwordSchema = z
  .string()
  .min(6, 'Senha deve ter no mínimo 6 caracteres')
  .max(100, 'Senha muito longa')

/**
 * Validação de nome
 */
export const nameSchema = z
  .string()
  .min(2, 'Nome deve ter no mínimo 2 caracteres')
  .max(100, 'Nome muito longo')

/**
 * Validação de telefone (formato internacional)
 */
export const phoneSchema = z
  .string()
  .regex(/^\d{10,15}$/, 'Telefone inválido. Use apenas números (10-15 dígitos)')

/**
 * Validação de ID (CUID)
 */
export const idSchema = z.string().cuid('ID inválido')

/**
 * Validação de mensagem WhatsApp
 */
export const whatsappMessageSchema = z.object({
  body: z.string().min(1, 'Mensagem não pode estar vazia').max(4096, 'Mensagem muito longa'),
  to: phoneSchema,
  type: z.enum(['text', 'image', 'video', 'document', 'audio', 'interactive', 'button']).optional(),
})

/**
 * Validação de registro de usuário
 */
export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
})

/**
 * Validação de login
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Senha é obrigatória'),
})

/**
 * Validação de workflow
 */
export const workflowSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  description: z.string().max(500).optional().nullable(),
  trigger: z.string().min(1, 'Trigger é obrigatório').max(100),
  isActive: z.boolean().optional(),
  isAIOnly: z.boolean().optional(),
  aiBusinessDetails: z.string().optional().nullable(),
  instanceId: idSchema.optional().nullable(),
})

/**
 * Validação de nó de workflow
 */
export const workflowNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['trigger', 'message', 'wait', 'questionnaire', 'ai', 'condition', 'transfer_to_human', 'close_chat']),
  positionX: z.number(),
  positionY: z.number(),
  data: z.record(z.any()),
})

/**
 * Validação de conexão de workflow
 */
export const workflowConnectionSchema = z.object({
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  sourceHandle: z.string().optional().nullable(),
  targetHandle: z.string().optional().nullable(),
})

/**
 * Validação de serviço
 */
export const serviceSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  description: z.string().max(500).optional().nullable(),
  price: z.number().min(0).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().optional(),
})

/**
 * Validação de agendamento
 */
export const appointmentSchema = z.object({
  contactNumber: phoneSchema,
  contactName: z.string().max(100).optional().nullable(),
  date: z.string().datetime('Data inválida'),
  duration: z.number().int().min(1).max(1440).optional().nullable(), // 1 minuto a 24 horas
  description: z.string().max(500).optional().nullable(),
  service: z.string().max(100).optional().nullable(),
})

/**
 * Validação de regra de automação
 */
export const automationRuleSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  trigger: z.string().min(1, 'Trigger é obrigatório').max(200),
  response: z.string().min(1, 'Resposta é obrigatória').max(4096),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  instanceId: idSchema.optional().nullable(),
})

/**
 * Validação de instância WhatsApp
 */
export const whatsappInstanceSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  phone: phoneSchema.optional().nullable(),
  phoneId: z.string().optional().nullable(),
  accessToken: z.string().optional().nullable(),
  appId: z.string().optional().nullable(),
  appSecret: z.string().optional().nullable(),
  webhookVerifyToken: z.string().optional().nullable(),
  businessAccountId: z.string().optional().nullable(),
})

/**
 * Validação de upload de arquivo
 */
export const uploadSchema = z.object({
  file: z.instanceof(File, { message: 'Arquivo inválido' }),
  maxSize: z.number().optional().default(10 * 1024 * 1024), // 10MB padrão
  allowedTypes: z.array(z.string()).optional(),
})

/**
 * Validação de paginação
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

/**
 * Validação de filtros de data
 */
export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

/**
 * Helper para validar dados com Zod
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data)
}

/**
 * Helper para validar dados com Zod (retorna erro ao invés de lançar)
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error }
}

