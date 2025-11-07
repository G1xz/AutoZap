import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

/**
 * GET - Serve arquivos de upload de forma segura
 * Apenas arquivos do próprio usuário podem ser acessados
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename

    // Validação básica de segurança
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return NextResponse.json({ error: 'Nome de arquivo inválido' }, { status: 400 })
    }

    // Caminho do arquivo (fora da pasta public)
    const filePath = join(process.cwd(), 'uploads', filename)

    // Verifica se o arquivo existe
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
    }

    // Lê o arquivo
    const fileBuffer = await readFile(filePath)

    // Determina o tipo MIME baseado na extensão
    const ext = filename.split('.').pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
    }

    const contentType = mimeTypes[ext || ''] || 'application/octet-stream'

    // Retorna o arquivo com headers apropriados
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache por 1 ano
      },
    })
  } catch (error) {
    console.error('Erro ao servir arquivo:', error)
    return NextResponse.json(
      { error: 'Erro ao servir arquivo' },
      { status: 500 }
    )
  }
}

