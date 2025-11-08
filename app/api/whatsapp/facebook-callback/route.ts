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
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Erro na autorização</title>
            <meta charset="UTF-8">
          </head>
          <body>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
              <h1 style="color: #dc2626;">❌ Erro na autorização</h1>
              <p>${error}</p>
              <p>Você pode fechar esta janela.</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'FACEBOOK_OAUTH_ERROR', message: '${error.replace(/'/g, "\\'")}' }, '*');
              }
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `
      return new NextResponse(errorHtml, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    if (!code || !state) {
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Parâmetros faltando</title>
            <meta charset="UTF-8">
          </head>
          <body>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
              <h1 style="color: #dc2626;">❌ Parâmetros faltando</h1>
              <p>Você pode fechar esta janela.</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'FACEBOOK_OAUTH_ERROR', message: 'Parâmetros faltando' }, '*');
              }
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `
      return new NextResponse(errorHtml, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    const instanceId = state

    // Verifica se a instância existe
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance) {
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Instância não encontrada</title>
            <meta charset="UTF-8">
          </head>
          <body>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
              <h1 style="color: #dc2626;">❌ Instância não encontrada</h1>
              <p>Você pode fechar esta janela.</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'FACEBOOK_OAUTH_ERROR', message: 'Instância não encontrada' }, '*');
              }
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `
      return new NextResponse(errorHtml, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    // Troca o código por access token
    const facebookAppId = process.env.FACEBOOK_CLIENT_ID
    const facebookAppSecret = process.env.FACEBOOK_CLIENT_SECRET
    const redirectUri = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/whatsapp/facebook-callback`

    if (!facebookAppId || !facebookAppSecret) {
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Configuração faltando</title>
            <meta charset="UTF-8">
          </head>
          <body>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
              <h1 style="color: #dc2626;">❌ Configuração faltando</h1>
              <p>Você pode fechar esta janela.</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'FACEBOOK_OAUTH_ERROR', message: 'Configuração faltando' }, '*');
              }
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `
      return new NextResponse(errorHtml, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
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
      const errorMessage = tokenData.error?.message || 'Erro ao obter access token'
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Erro ao obter token</title>
            <meta charset="UTF-8">
          </head>
          <body>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
              <h1 style="color: #dc2626;">❌ Erro ao obter token</h1>
              <p>${errorMessage}</p>
              <p>Você pode fechar esta janela.</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'FACEBOOK_OAUTH_ERROR', message: '${errorMessage.replace(/'/g, "\\'")}' }, '*');
              }
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `
      return new NextResponse(errorHtml, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    const accessToken = tokenData.access_token
    console.log('✅ Access token obtido com sucesso')

    // Tenta obter informações da conta Meta Business
    console.log('🏢 Tentando obter contas Meta Business...')
    let businessAccountId: string | null = null
    let whatsappBusinessAccountId: string | null = null
    
    // Método 1: Tenta /me/businesses (requer business_management)
    try {
      const businessAccountsResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/businesses?access_token=${accessToken}`
      )
      const businessAccounts = await businessAccountsResponse.json()
      console.log('📦 Business accounts response:', businessAccounts)

      if (businessAccounts.data && businessAccounts.data.length > 0) {
        businessAccountId = businessAccounts.data[0].id
        console.log('✅ Business Account ID obtido:', businessAccountId)
      } else if (businessAccounts.error) {
        console.log('⚠️ Erro ao obter business accounts:', businessAccounts.error)
        // Continua tentando método alternativo
      }
    } catch (err) {
      console.log('⚠️ Erro ao tentar /me/businesses:', err)
    }

    // Método 2: Tenta acessar WhatsApp Business Accounts diretamente via App ID
    if (!businessAccountId) {
      console.log('🔄 Tentando método alternativo: acessar WhatsApp Business Accounts via App...')
      try {
        // Tenta obter WhatsApp Business Accounts do app diretamente
        const wabaDirectResponse = await fetch(
          `https://graph.facebook.com/v18.0/${facebookAppId}/whatsapp_business_accounts?access_token=${accessToken}`
        )
        const wabaDirectData = await wabaDirectResponse.json()
        console.log('📦 WABA direct response:', wabaDirectData)

        if (wabaDirectData.data && wabaDirectData.data.length > 0) {
          whatsappBusinessAccountId = wabaDirectData.data[0].id
          console.log('✅ WhatsApp Business Account ID obtido diretamente:', whatsappBusinessAccountId)
        }
      } catch (err) {
        console.log('⚠️ Erro ao tentar método alternativo:', err)
      }
    }

    // Se ainda não temos WhatsApp Business Account ID, tenta via Business Account
    if (!whatsappBusinessAccountId && businessAccountId) {
      console.log('📱 Obtendo WhatsApp Business Accounts via Business Account...')
      try {
        const wabaResponse = await fetch(
          `https://graph.facebook.com/v18.0/${businessAccountId}/owned_whatsapp_business_accounts?access_token=${accessToken}`
        )
        const wabaData = await wabaResponse.json()
        console.log('📦 WABA data:', wabaData)

        if (wabaData.data && wabaData.data.length > 0) {
          whatsappBusinessAccountId = wabaData.data[0].id
          console.log('✅ WhatsApp Business Account ID:', whatsappBusinessAccountId)
        }
      } catch (err) {
        console.log('⚠️ Erro ao obter WABA:', err)
      }
    }

    if (!whatsappBusinessAccountId) {
      console.error('❌ Não foi possível obter WhatsApp Business Account ID')
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Erro ao obter conta WhatsApp Business</title>
            <meta charset="UTF-8">
          </head>
          <body>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
              <h1 style="color: #dc2626;">❌ Erro ao obter conta WhatsApp Business</h1>
              <p>Não foi possível acessar sua conta WhatsApp Business.</p>
              <p style="font-size: 12px; color: #666; margin-top: 20px;">
                Possíveis causas:<br/>
                - Permissões insuficientes (precisa de business_management)<br/>
                - Conta WhatsApp Business não configurada<br/>
                - App não vinculado à conta Business
              </p>
              <p>Você pode fechar esta janela.</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'FACEBOOK_OAUTH_ERROR', message: 'Não foi possível obter conta WhatsApp Business. Verifique se tem business_management configurado.' }, '*');
              }
              setTimeout(() => window.close(), 5000);
            </script>
          </body>
        </html>
      `
      return new NextResponse(errorHtml, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    // Obtém Phone Number ID
    console.log('📞 Obtendo Phone Numbers...')
    const phoneNumbersResponse = await fetch(
      `https://graph.facebook.com/v18.0/${whatsappBusinessAccountId}/phone_numbers?access_token=${accessToken}`
    )
    const phoneNumbers = await phoneNumbersResponse.json()
    console.log('📦 Phone numbers:', phoneNumbers)

    if (!phoneNumbers.data || phoneNumbers.data.length === 0) {
      console.error('❌ Nenhum número de telefone encontrado')
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Nenhum número de telefone encontrado</title>
            <meta charset="UTF-8">
          </head>
          <body>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
              <h1 style="color: #dc2626;">❌ Nenhum número de telefone encontrado</h1>
              <p>Você precisa ter um número de telefone verificado no WhatsApp Business.</p>
              <p>Você pode fechar esta janela.</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'FACEBOOK_OAUTH_ERROR', message: 'Nenhum número de telefone encontrado' }, '*');
              }
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `
      return new NextResponse(errorHtml, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
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
        businessAccountId: businessAccountId || undefined,
        phone: phoneNumber,
        status: 'connected',
      },
    })
    console.log('✅ Instância atualizada com sucesso!')

    // Retorna uma página HTML que fecha a janela popup e notifica a janela pai
    const successHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Conectado com sucesso!</title>
          <meta charset="UTF-8">
        </head>
        <body>
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
            <h1 style="color: #25D366;">✅ Conectado com sucesso!</h1>
            <p>Você pode fechar esta janela.</p>
          </div>
          <script>
            // Notifica a janela pai que a conexão foi bem-sucedida
            if (window.opener) {
              window.opener.postMessage({ type: 'FACEBOOK_OAUTH_SUCCESS', instanceId: '${instanceId}' }, '*');
            }
            // Fecha a janela após 1 segundo
            setTimeout(() => {
              window.close();
            }, 1000);
          </script>
        </body>
      </html>
    `

    return new NextResponse(successHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    console.error('Erro no callback do Facebook:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    
    // Retorna uma página HTML que fecha a janela popup e notifica a janela pai do erro
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Erro na conexão</title>
          <meta charset="UTF-8">
        </head>
        <body>
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
            <h1 style="color: #dc2626;">❌ Erro na conexão</h1>
            <p>${errorMessage}</p>
            <p>Você pode fechar esta janela.</p>
          </div>
          <script>
            // Notifica a janela pai que houve um erro
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'FACEBOOK_OAUTH_ERROR', 
                message: '${errorMessage.replace(/'/g, "\\'")}' 
              }, '*');
            }
            // Fecha a janela após 3 segundos
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
      </html>
    `

    return new NextResponse(errorHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}

