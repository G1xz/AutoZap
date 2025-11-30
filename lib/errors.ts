/**
 * Sistema de tratamento de erros customizado
 * Classes de erro específicas para diferentes tipos de problemas
 */

import { log } from './logger'

/**
 * Erro base customizado
 */
export class AppError extends Error {
  public readonly statusCode: number
  public readonly isOperational: boolean
  public readonly code?: string

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    isOperational: boolean = true
  ) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.code = code
    this.isOperational = isOperational

    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Erro de validação (400)
 */
export class ValidationError extends AppError {
  public readonly fields?: Record<string, string[]>

  constructor(message: string, fields?: Record<string, string[]>) {
    super(message, 400, 'VALIDATION_ERROR')
    this.fields = fields
  }
}

/**
 * Erro de autenticação (401)
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Não autenticado') {
    super(message, 401, 'AUTHENTICATION_ERROR')
  }
}

/**
 * Erro de autorização (403)
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Não autorizado') {
    super(message, 403, 'AUTHORIZATION_ERROR')
  }
}

/**
 * Erro de recurso não encontrado (404)
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Recurso') {
    super(`${resource} não encontrado`, 404, 'NOT_FOUND')
  }
}

/**
 * Erro de conflito (409)
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR')
  }
}

/**
 * Erro de rate limit (429)
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Muitas requisições. Tente novamente mais tarde.') {
    super(message, 429, 'RATE_LIMIT_ERROR')
  }
}

/**
 * Erro de serviço externo (502)
 */
export class ExternalServiceError extends AppError {
  public readonly service: string

  constructor(service: string, message: string) {
    super(`Erro ao comunicar com ${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR')
    this.service = service
  }
}

/**
 * Erro de configuração (500)
 */
export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(`Erro de configuração: ${message}`, 500, 'CONFIGURATION_ERROR', false)
  }
}

/**
 * Trata erros e retorna resposta apropriada
 */
export function handleError(error: unknown): {
  message: string
  statusCode: number
  code?: string
  fields?: Record<string, string[]>
} {
  // Erro conhecido do App
  if (error instanceof AppError) {
    // Log apenas erros não operacionais (bugs)
    if (!error.isOperational) {
      log.error('Erro não operacional', error)
    }

    return {
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      fields: error instanceof ValidationError ? error.fields : undefined,
    }
  }

  // Erro de validação Zod
  if (error && typeof error === 'object' && 'issues' in error) {
    const zodError = error as { issues: Array<{ path: (string | number)[]; message: string }> }
    const fields: Record<string, string[]> = {}

    zodError.issues.forEach((issue) => {
      const path = issue.path.join('.')
      if (!fields[path]) {
        fields[path] = []
      }
      fields[path].push(issue.message)
    })

    return {
      message: 'Dados inválidos',
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      fields,
    }
  }

  // Erro padrão do JavaScript
  if (error instanceof Error) {
    log.error('Erro não tratado', error)
    return {
      message: process.env.NODE_ENV === 'production' 
        ? 'Ocorreu um erro interno. Nossa equipe foi notificada.'
        : error.message,
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    }
  }

  // Erro desconhecido
  log.error('Erro desconhecido', error)
  return {
    message: 'Ocorreu um erro inesperado',
    statusCode: 500,
    code: 'UNKNOWN_ERROR',
  }
}

/**
 * Middleware de tratamento de erros para Next.js API routes
 */
export function errorHandler(error: unknown) {
  const handled = handleError(error)
  
  return {
    error: handled.message,
    code: handled.code,
    ...(handled.fields && { fields: handled.fields }),
  }
}

