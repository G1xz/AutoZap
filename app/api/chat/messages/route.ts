import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET - Busca mensagens de uma conversa específica
 * Query params: instanceId, contactNumber
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const instanceId = searchParams.get('instanceId')
    const contactNumber = searchParams.get('contactNumber')
    const limit = parseInt(searchParams.get('limit') || '100') // Padrão: 100 mensagens
    const offset = parseInt(searchParams.get('offset') || '0') // Para paginação

    if (!instanceId || !contactNumber) {
      return NextResponse.json(
        { error: 'instanceId e contactNumber são obrigatórios' },
        { status: 400 }
      )
    }

    // Verifica se a instância pertence ao usuário
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance || instance.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Instância não encontrada' },
        { status: 404 }
      )
    }

    // Busca o número da instância para identificar mensagens enviadas
    const instancePhone = instance.phone || instance.phoneId || ''

    // Normaliza o número do contato para buscar (remove formatação)
    const normalizePhone = (phone: string) => phone.replace(/\D/g, '')
    const normalizedContact = normalizePhone(contactNumber)
    
    // Formata para o padrão internacional (com código do país se não tiver)
    const formattedContact = normalizedContact.startsWith('55')
      ? normalizedContact
      : `55${normalizedContact}`

    // Busca mensagens da conversa (tanto recebidas quanto enviadas)
    // Mensagens recebidas: from pode estar em qualquer formato
    // Mensagens enviadas: to pode estar formatado (5511999999999) ou não (11999999999)
    // Limita a mensagens mais recentes para não sobrecarregar
    const totalCount = await prisma.message.count({
      where: {
        instanceId,
        OR: [
          { from: contactNumber }, // Formato original
          { from: normalizedContact }, // Sem formatação
          { from: formattedContact }, // Com código do país
          { to: contactNumber, isFromMe: true }, // Formato original
          { to: normalizedContact, isFromMe: true }, // Sem formatação
          { to: formattedContact, isFromMe: true }, // Com código do país
        ],
      },
    })

    const messages = await prisma.message.findMany({
      where: {
        instanceId,
        OR: [
          { from: contactNumber }, // Formato original
          { from: normalizedContact }, // Sem formatação
          { from: formattedContact }, // Com código do país
          { to: contactNumber, isFromMe: true }, // Formato original
          { to: normalizedContact, isFromMe: true }, // Sem formatação
          { to: formattedContact, isFromMe: true }, // Com código do país
        ],
      },
      orderBy: {
        timestamp: 'desc', // Mais recentes primeiro
      },
      take: Math.min(limit, 200), // Máximo 200 mensagens por vez
      skip: offset,
    })

    // Inverte para mostrar do mais antigo ao mais recente
    messages.reverse()

    console.log(`📨 Buscando mensagens para conversa: instanceId=${instanceId}, contactNumber=${contactNumber}`)
    console.log(`📊 Formato normalizado: ${normalizedContact}, formato internacional: ${formattedContact}`)
    console.log(`📊 Total de mensagens no banco: ${totalCount}`)
    console.log(`📊 Mensagens retornadas: ${messages.length} (limit: ${limit}, offset: ${offset})`)
    console.log(`📊 Mensagens recebidas: ${messages.filter(m => !m.isFromMe).length}`)
    console.log(`📊 Mensagens enviadas: ${messages.filter(m => m.isFromMe).length}`)
    
    // Log de debug: mostra algumas mensagens encontradas
    if (messages.length > 0) {
      console.log(`📋 Primeiras 3 mensagens encontradas:`)
      messages.slice(0, 3).forEach((msg, idx) => {
        console.log(`  ${idx + 1}. ${msg.isFromMe ? 'ENVIADA' : 'RECEBIDA'} - from: ${msg.from}, to: ${msg.to}, body: ${msg.body.substring(0, 50)}...`)
      })
    }

    return NextResponse.json({
      messages,
      totalCount,
      hasMore: totalCount > offset + messages.length,
    })
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar mensagens' },
      { status: 500 }
    )
  }
}

/**
 * POST - Envia uma mensagem manual
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { instanceId, to, message } = body

    if (!instanceId || !to || !message) {
      return NextResponse.json(
        { error: 'instanceId, to e message são obrigatórios' },
        { status: 400 }
      )
    }

    // Verifica se a instância pertence ao usuário
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance || instance.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Instância não encontrada' },
        { status: 404 }
      )
    }

    // Envia a mensagem usando a função existente
    const { sendWhatsAppMessage } = await import('@/lib/whatsapp-cloud-api')
    const result = await sendWhatsAppMessage(instanceId, to, message, 'service')

    // Salva a mensagem no banco como enviada
    if (result) {
      await prisma.message.create({
        data: {
          instanceId,
          from: instance.phone || instance.phoneId || '', // Número da instância
          to: to,
          body: message,
          timestamp: new Date(),
          isFromMe: true,
          isGroup: false,
          messageId: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // ID único para mensagem manual
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao enviar mensagem' },
      { status: 500 }
    )
  }
}

