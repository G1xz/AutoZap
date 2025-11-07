import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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

    // Cria diretório de uploads FORA da pasta public (mais seguro)
    // Em produção, considere usar S3, Cloudinary ou Vercel Blob Storage
    const uploadsDir = join(process.cwd(), 'uploads')
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true })
    }

    // Gera nome único para o arquivo
    const timestamp = Date.now()
    const fileName = `${session.user.id}-${timestamp}-${file.name}`
    const filePath = join(uploadsDir, fileName)

    // Salva o arquivo
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Retorna URL da API que serve o arquivo (não diretamente do public)
    const fileUrl = `/api/files/${fileName}`

    return NextResponse.json({
      url: fileUrl,
      fileName: file.name,
      size: file.size,
      type: file.type,
    })
  } catch (error) {
    console.error('Erro ao fazer upload:', error)
    return NextResponse.json(
      { error: 'Erro ao fazer upload do arquivo' },
      { status: 500 }
    )
  }
}


