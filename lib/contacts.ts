// Armazena nomes de contatos conhecidos (em produção, usar banco de dados)
const contactNames = new Map<string, string>()

/**
 * Salva o nome de um contato
 */
export function setContactName(instanceId: string, phoneNumber: string, name: string): void {
  const key = `${instanceId}-${phoneNumber}`
  contactNames.set(key, name)
}

/**
 * Busca o nome de um contato
 */
export function getContactName(instanceId: string, phoneNumber: string): string | null {
  const key = `${instanceId}-${phoneNumber}`
  return contactNames.get(key) || null
}

/**
 * Busca todos os nomes de contatos conhecidos
 */
export function getAllContactNames(): Map<string, string> {
  return contactNames
}

