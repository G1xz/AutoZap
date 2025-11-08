import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

/**
 * POST - Inicia conexão via Facebook OAuth
 * 
 * O cliente autoriza via Facebook e você obtém as credenciais automaticamente
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

    // Verifica se a instância pertence ao usuário
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance || instance.userId !== session.user.id) {
      return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })
    }

    // Gera URL de autorização do Facebook
    const facebookAppId = process.env.FACEBOOK_CLIENT_ID
    const redirectUri = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/whatsapp/facebook-callback`
    
    if (!facebookAppId) {
      return NextResponse.json(
        { error: 'FACEBOOK_CLIENT_ID não configurado' },
        { status: 500 }
      )
    }

    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${facebookAppId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=email,public_profile,business_management,whatsapp_business_management,whatsapp_business_messaging,pages_read_engagement,pages_manage_metadata` +
      `&state=${instanceId}` // Passa instanceId no state para recuperar depois

    return NextResponse.json({
      success: true,
      authUrl,
      message: 'Redirecione o cliente para esta URL para autorizar',
    })
  } catch (error) {
    console.error('Erro ao gerar URL de autorização:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar URL de autorização' },
      { status: 500 }
    )
  }
}


