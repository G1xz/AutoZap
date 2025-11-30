/**
 * Sistema de logging estruturado
 * Usa Pino para logging eficiente e estruturado
 */

import pino from 'pino'

const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'

// Detecta se está em ambiente Next.js (onde thread-stream pode não funcionar)
const isNextJS = typeof window === 'undefined' && typeof process !== 'undefined' && process.env.NEXT_RUNTIME

// Configuração do logger
// Em Next.js, não usa transport para evitar problemas com thread-stream
const loggerConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() }
    },
  },
  // Em produção, não loga dados sensíveis
  redact: isProduction
    ? [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.accessToken',
        '*.token',
        '*.secret',
        '*.apiKey',
        'body.accessToken',
        'body.token',
        'body.secret',
        'body.password',
      ]
    : [],
}

// Só usa transport se não estiver em Next.js e estiver em desenvolvimento
if (isDevelopment && !isNextJS) {
  try {
    loggerConfig.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    }
  } catch (error) {
    // Se falhar ao configurar transport, continua sem ele
    console.warn('Não foi possível configurar pino-pretty, usando logger básico')
  }
}

const logger = pino(loggerConfig)

/**
 * Sanitiza dados sensíveis antes de logar
 */
function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data
  }

  const sensitiveKeys = [
    'password',
    'accessToken',
    'token',
    'secret',
    'apiKey',
    'authorization',
    'cookie',
  ]

  const sanitized = { ...data }

  for (const key in sanitized) {
    const lowerKey = key.toLowerCase()
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key])
    }
  }

  return sanitized
}

/**
 * Logger com métodos auxiliares
 * Protegido contra erros para não quebrar a aplicação
 */
const safeLog = (fn: () => void) => {
  try {
    fn()
  } catch (error) {
    // Em caso de erro no logger, usa console como fallback
    console.error('Erro no logger:', error)
  }
}

export const log = {
  /**
   * Log de debug (apenas em desenvolvimento)
   */
  debug: (message: string, data?: any) => {
    if (isDevelopment) {
      safeLog(() => logger.debug(sanitizeData(data), message))
    }
  },

  /**
   * Log de informação
   */
  info: (message: string, data?: any) => {
    safeLog(() => logger.info(sanitizeData(data), message))
  },

  /**
   * Log de aviso
   */
  warn: (message: string, data?: any) => {
    safeLog(() => logger.warn(sanitizeData(data), message))
  },

  /**
   * Log de erro
   */
  error: (message: string, error?: Error | any, data?: any) => {
    safeLog(() => {
      const errorData = error instanceof Error 
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
            ...sanitizeData(data),
          }
        : { error, ...sanitizeData(data) }
      
      logger.error(errorData, message)
    })
  },

  /**
   * Log estruturado para eventos de negócio
   */
  event: (event: string, data?: any) => {
    safeLog(() => logger.info(sanitizeData(data), `[EVENT] ${event}`))
  },

  /**
   * Log para métricas
   */
  metric: (metric: string, value: number, tags?: Record<string, string>) => {
    safeLog(() => logger.info({ metric, value, tags: sanitizeData(tags) }, `[METRIC] ${metric}`))
  },
}

export default logger

