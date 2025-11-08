import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET - Callback do Facebook OAuth para conectar WhatsApp
 * 
 * Este endpoint recebe o código de autorização do Facebook e obtém
 * automaticamente as credenciais do WhatsApp (Phone Number ID, Access Token, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state') // instanceId
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard?error=facebook_auth_failed&message=${encodeURIComponent(error)}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard?error=missing_params`
      )
    }

    const instanceId = state

    // Verifica se a instância existe
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard?error=instance_not_found`
      )
    }

    // Troca o código por access token
    const facebookAppId = process.env.FACEBOOK_CLIENT_ID
    const facebookAppSecret = process.env.FACEBOOK_CLIENT_SECRET
    const redirectUri = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/whatsapp/facebook-callback`

    if (!facebookAppId || !facebookAppSecret) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard?error=config_missing`
      )
    }

    // Obtém access token do Facebook
    console.log('🔑 Obtendo access token do Facebook...')
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `client_id=${facebookAppId}` +
      `&client_secret=${facebookAppSecret}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${code}`,
      { method: 'GET' }
    )

    const tokenData = await tokenResponse.json()
    console.log('📦 Token response:', tokenData)

    if (!tokenData.access_token) {
      console.error('❌ Erro ao obter access token:', tokenData)
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard?error=token_failed&details=${encodeURIComponent(JSON.stringify(tokenData))}`
      )
    }

    const accessToken = tokenData.access_token
    console.log('✅ Access token obtido com sucesso')

    // Obtém informações da conta Meta Business
    console.log('🏢 Obtendo contas Meta Business...')
    const businessAccountsResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/businesses?access_token=${accessToken}`
    )
    const businessAccounts = await businessAccountsResponse.json()
    console.log('📦 Business accounts:', businessAccounts)

    if (!businessAccounts.data || businessAccounts.data.length === 0) {
      console.error('❌ Nenhuma conta Meta Business encontrada')
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard?error=no_business_account`
      )
    }

    const businessAccountId = businessAccounts.data[0].id
    console.log('✅ Business Account ID:', businessAccountId)

    // Obtém WhatsApp Business Accounts
    console.log('📱 Obtendo WhatsApp Business Accounts...')
    const wabaResponse = await fetch(
      `https://graph.facebook.com/v18.0/${businessAccountId}/owned_whatsapp_business_accounts?access_token=${accessToken}`
    )
    const wabaData = await wabaResponse.json()
    console.log('📦 WABA data:', wabaData)

    if (!wabaData.data || wabaData.data.length === 0) {
      console.error('❌ Nenhuma conta WhatsApp Business encontrada')
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard?error=no_whatsapp_account`
      )
    }

    const whatsappBusinessAccountId = wabaData.data[0].id
    console.log('✅ WhatsApp Business Account ID:', whatsappBusinessAccountId)

    // Obtém Phone Number ID
    console.log('📞 Obtendo Phone Numbers...')
    const phoneNumbersResponse = await fetch(
      `https://graph.facebook.com/v18.0/${whatsappBusinessAccountId}/phone_numbers?access_token=${accessToken}`
    )
    const phoneNumbers = await phoneNumbersResponse.json()
    console.log('📦 Phone numbers:', phoneNumbers)

    if (!phoneNumbers.data || phoneNumbers.data.length === 0) {
      console.error('❌ Nenhum número de telefone encontrado')
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard?error=no_phone_number`
      )
    }

    const phoneNumberId = phoneNumbers.data[0].id
    const phoneNumber = phoneNumbers.data[0].display_phone_number || phoneNumbers.data[0].verified_name || ''
    console.log('✅ Phone Number ID:', phoneNumberId, 'Phone:', phoneNumber)

    // Obtém App ID
    const appResponse = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id&access_token=${accessToken}`
    )
    const appData = await appResponse.json()
    const appId = appData.id || facebookAppId

    // Atualiza a instância com as credenciais
    console.log('💾 Atualizando instância no banco de dados...')
    await prisma.whatsAppInstance.update({
      where: { id: instanceId },
      data: {
        phoneId: phoneNumberId,
        accessToken: accessToken, // Em produção, criptografar este token
        appId: appId,
        businessAccountId: businessAccountId,
        phone: phoneNumber,
        status: 'connected',
      },
    })
    console.log('✅ Instância atualizada com sucesso!')

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard?success=whatsapp_connected&instanceId=${instanceId}`
    )
  } catch (error) {
    console.error('Erro no callback do Facebook:', error)
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard?error=callback_failed&message=${encodeURIComponent(error instanceof Error ? error.message : 'Erro desconhecido')}`
    )
  }
}

