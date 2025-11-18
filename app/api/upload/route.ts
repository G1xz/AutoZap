import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { uploadFileToCloudinary } from '@/lib/cloudinary'

// Força rota dinâmica para evitar execução durante o build
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    // Valida tamanho máximo (10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Máximo de 10MB.' },
        { status: 400 }
      )
    }

    // Valida tipo de arquivo
    const allowedTypes = ['image/', 'video/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    const isValidType = allowedTypes.some(type => file.type.startsWith(type))
    
    if (!isValidType) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não permitido. Use imagem, vídeo ou documento PDF/DOC.' },
        { status: 400 }
      )
    }

    // Converte arquivo para Buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Determina resource_type baseado no tipo do arquivo
    let resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto'
    if (file.type.startsWith('image/')) {
      resourceType = 'image'
    } else if (file.type.startsWith('video/')) {
      resourceType = 'video'
    } else {
      resourceType = 'raw' // Para documentos PDF, DOC, etc.
    }

    // Faz upload para Cloudinary
    const folder = `autozap/${session.user.id}`
    const uploadResult = await uploadFileToCloudinary(
      buffer,
      file.name,
      folder,
      resourceType
    )

    console.log(`✅ Arquivo enviado para Cloudinary: ${uploadResult.secure_url}`)

    return NextResponse.json({
      url: uploadResult.secure_url, // URL HTTPS do Cloudinary
      fileName: file.name,
      size: file.size,
      type: file.type,
      public_id: uploadResult.public_id,
    })
  } catch (error) {
    console.error('Erro ao fazer upload:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao fazer upload do arquivo' },
      { status: 500 }
    )
  }
}


