import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getLocaltunnelUrl, setLocaltunnelUrl } from '@/lib/localtunnel'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { url } = body

    if (!url) {
      return NextResponse.json({ error: 'URL é obrigatória' }, { status: 400 })
    }

    setLocaltunnelUrl(session.user.id, url)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao salvar URL do localtunnel:', error)
    return NextResponse.json(
      { error: 'Erro ao salvar URL' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const url = getLocaltunnelUrl(session.user.id)

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Erro ao buscar URL do localtunnel:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar URL' },
      { status: 500 }
    )
  }
}


