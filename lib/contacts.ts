import { prisma } from './prisma'

/**
 * Salva ou atualiza informações de um contato (nome e foto de perfil)
 */
export async function setContactInfo(
  instanceId: string,
  phoneNumber: string,
  name?: string,
  profilePictureUrl?: string
): Promise<void> {
  try {
    await prisma.contact.upsert({
      where: {
        instanceId_phoneNumber: {
          instanceId,
          phoneNumber,
        },
      },
      update: {
        name: name !== undefined ? name : undefined,
        profilePictureUrl: profilePictureUrl !== undefined ? profilePictureUrl : undefined,
        lastSeen: new Date(),
      },
      create: {
        instanceId,
        phoneNumber,
        name: name || null,
        profilePictureUrl: profilePictureUrl || null,
        lastSeen: new Date(),
      },
    })
  } catch (error) {
    console.error('Erro ao salvar informações do contato:', error)
  }
}

/**
 * Busca o nome de um contato
 */
export async function getContactName(instanceId: string, phoneNumber: string): Promise<string | null> {
  try {
    const contact = await prisma.contact.findUnique({
      where: {
        instanceId_phoneNumber: {
          instanceId,
          phoneNumber,
        },
      },
      select: { name: true },
    })
    return contact?.name || null
  } catch (error) {
    console.error('Erro ao buscar nome do contato:', error)
    return null
  }
}

/**
 * Busca a foto de perfil de um contato
 */
export async function getContactProfilePicture(
  instanceId: string,
  phoneNumber: string
): Promise<string | null> {
  try {
    const contact = await prisma.contact.findUnique({
      where: {
        instanceId_phoneNumber: {
          instanceId,
          phoneNumber,
        },
      },
      select: { profilePictureUrl: true },
    })
    return contact?.profilePictureUrl || null
  } catch (error) {
    console.error('Erro ao buscar foto de perfil do contato:', error)
    return null
  }
}

/**
 * Salva o nome de um contato (compatibilidade com código antigo)
 */
export function setContactName(instanceId: string, phoneNumber: string, name: string): void {
  // Chama a versão async mas não aguarda (para compatibilidade)
  setContactInfo(instanceId, phoneNumber, name).catch(console.error)
}

