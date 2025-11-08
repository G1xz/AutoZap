import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import QRCode from 'qrcode'

/**
 * GET - Gera QR Code para conexão via coexistência
 * 
 * O cliente escaneia o QR Code no app WhatsApp Business:
 * Configurações > Dispositivos Conectados > Conectar Dispositivo
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const instanceId = searchParams.get('instanceId')

    if (!instanceId) {
      return NextResponse.json({ error: 'instanceId é obrigatório' }, { status: 400 })
    }

    // Verifica se a instância pertence ao usuário
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance || instance.userId !== session.user.id) {
      return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })
    }

    // Gera um token único para esta conexão
    const connectionToken = `whatsapp_${instanceId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Salva o token na instância (temporário, será usado para verificar conexão)
    await prisma.whatsAppInstance.update({
      where: { id: instanceId },
      data: {
        status: 'connecting',
        webhookVerifyToken: connectionToken, // Reutiliza o campo temporariamente
      },
    })

    // URL que será codificada no QR Code
    // Formato: whatsapp://connect?token=xxx&instanceId=xxx
    const qrData = JSON.stringify({
      type: 'whatsapp_connection',
      instanceId: instanceId,
      token: connectionToken,
      timestamp: Date.now(),
    })

    // Gera o QR Code como imagem PNG
    const qrCodeImage = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 2,
    })

    return NextResponse.json({
      success: true,
      qrCode: qrCodeImage,
      connectionToken: connectionToken,
      instructions: {
        step1: 'Abra o WhatsApp Business no seu celular',
        step2: 'Vá em Configurações > Dispositivos Conectados',
        step3: 'Toque em "Conectar Dispositivo"',
        step4: 'Escaneie este QR Code',
        step5: 'Aguarde a confirmação de conexão',
      },
    })
  } catch (error) {
    console.error('Erro ao gerar QR Code:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar QR Code' },
      { status: 500 }
    )
  }
}

/**
 * POST - Verifica se a conexão foi estabelecida
 * 
 * Este endpoint deve ser chamado periodicamente enquanto o QR Code está sendo exibido
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { instanceId } = body

    if (!instanceId) {
      return NextResponse.json({ error: 'instanceId é obrigatório' }, { status: 400 })
    }

    // Busca a instância
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance || instance.userId !== session.user.id) {
      return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })
    }

    // Verifica se a conexão foi estabelecida
    // Se o status mudou para 'connected' ou 'verified', significa que conectou
    const isConnected = instance.status === 'connected' || instance.status === 'verified'
    const hasPhoneId = !!instance.phoneId
    const hasAccessToken = !!instance.accessToken

    return NextResponse.json({
      connected: isConnected && hasPhoneId && hasAccessToken,
      status: instance.status,
      phoneId: instance.phoneId,
      phone: instance.phone,
    })
  } catch (error) {
    console.error('Erro ao verificar conexão:', error)
    return NextResponse.json(
      { error: 'Erro ao verificar conexão' },
      { status: 500 }
    )
  }
}

