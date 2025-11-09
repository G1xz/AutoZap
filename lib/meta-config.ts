/**
 * Configurações fixas da conta Meta Business central
 * 
 * Use estas configurações para todos os números que você adicionar.
 * Só o Phone Number ID muda por número.
 */

export const metaConfig = {
  // App ID - Mesmo para todos os números
  appId: process.env.META_APP_ID || process.env.FACEBOOK_CLIENT_ID || '',
  
  // Access Token Permanente - Mesmo para todos os números
  accessToken: process.env.META_ACCESS_TOKEN || '',
  
  // Business Account ID - Mesmo para todos os números
  businessAccountId: process.env.META_BUSINESS_ACCOUNT_ID || '',
}

/**
 * Obtém as configurações fixas da Meta
 * 
 * @throws Error se as configurações não estiverem definidas
 */
export function getMetaConfig() {
  if (!metaConfig.appId) {
    throw new Error('META_APP_ID ou FACEBOOK_CLIENT_ID não encontrado. Verifique as variáveis de ambiente.')
  }
  
  if (!metaConfig.accessToken) {
    throw new Error('META_ACCESS_TOKEN não encontrado. Verifique as variáveis de ambiente.')
  }
  
  return metaConfig
}

/**
 * Obtém o Access Token, usando o da instância se disponível, 
 * ou o token padrão do .env como fallback
 */
export function getAccessToken(instanceToken?: string | null): string {
  // Se a instância tem token próprio, usa ele
  if (instanceToken) {
    return instanceToken
  }
  
  // Senão, usa o token padrão do .env
  if (metaConfig.accessToken) {
    return metaConfig.accessToken
  }
  
  throw new Error('Access Token não encontrado. Configure META_ACCESS_TOKEN no .env ou configure o token na instância.')
}

