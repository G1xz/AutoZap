import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadFileToCloudinary, deleteFromCloudinary } from '@/lib/cloudinary'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        profilePictureUrl: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Erro ao buscar perfil:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar perfil' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verifica se a coluna profilePictureUrl existe
    try {
      const columnCheck = await prisma.$queryRawUnsafe(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'User' 
        AND column_name = 'profilePictureUrl';
      `) as Array<{ column_name: string }>

      if (columnCheck.length === 0) {
        // Cria a coluna se não existir
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "User" 
          ADD COLUMN IF NOT EXISTS "profilePictureUrl" TEXT;
        `)
        console.log('✅ Coluna profilePictureUrl criada')
      }
    } catch (colError: any) {
      console.error('Erro ao verificar/criar coluna profilePictureUrl:', colError)
      // Continua mesmo se houver erro na verificação
    }

    // Lê o formData uma única vez
    const formData = await request.formData()
    const name = formData.get('name') as string | null
    const file = formData.get('file') as File | null
    const removePhoto = formData.get('removePhoto') === 'true'

    // Busca o usuário atual para obter a foto antiga
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { profilePictureUrl: true },
    })

    let profilePictureUrl: string | null | undefined = undefined

    // Se deve remover a foto
    if (removePhoto) {
      // Deleta a foto antiga do Cloudinary se existir
      if (currentUser?.profilePictureUrl) {
        try {
          const oldUrl = currentUser.profilePictureUrl
          const publicIdMatch = oldUrl.match(/\/v\d+\/(.+?)(\.[^.]+)?$/)
          if (publicIdMatch) {
            const publicId = publicIdMatch[1]
            await deleteFromCloudinary(publicId)
          }
        } catch (error) {
          console.error('Erro ao deletar foto antiga:', error)
        }
      }
      profilePictureUrl = null
    }
    // Se há um arquivo, faz upload
    else if (file && file.size > 0) {
      // Valida tamanho máximo (5MB para foto de perfil)
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: 'Arquivo muito grande. Máximo de 5MB.' },
          { status: 400 }
        )
      }

      // Valida tipo de arquivo (apenas imagens)
      if (!file.type.startsWith('image/')) {
        return NextResponse.json(
          { error: 'Apenas imagens são permitidas para foto de perfil.' },
          { status: 400 }
        )
      }

      // Converte arquivo para Buffer
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // Faz upload para Cloudinary
      const folder = `autozap/${session.user.id}/profile`
      const uploadResult = await uploadFileToCloudinary(
        buffer,
        file.name,
        folder,
        'image'
      )

      profilePictureUrl = uploadResult.secure_url

      // Deleta a foto antiga do Cloudinary se existir
      if (currentUser?.profilePictureUrl) {
        try {
          // Extrai o public_id da URL antiga
          const oldUrl = currentUser.profilePictureUrl
          const publicIdMatch = oldUrl.match(/\/v\d+\/(.+?)(\.[^.]+)?$/)
          if (publicIdMatch) {
            const publicId = publicIdMatch[1]
            await deleteFromCloudinary(publicId)
          }
        } catch (error) {
          console.error('Erro ao deletar foto antiga:', error)
          // Não falha a operação se não conseguir deletar a foto antiga
        }
      }
    }

    // Atualiza o usuário
    const updateData: { name?: string; profilePictureUrl?: string | null } = {}
    
    // Sempre atualiza o nome se foi fornecido
    if (name !== null) {
      const trimmedName = name.trim()
      if (trimmedName) {
        updateData.name = trimmedName
      } else {
        return NextResponse.json(
          { error: 'O nome não pode estar vazio' },
          { status: 400 }
        )
      }
    }
    
    // Atualiza foto apenas se foi especificado (upload ou remoção)
    if (profilePictureUrl !== undefined) {
      updateData.profilePictureUrl = profilePictureUrl
    }

    // Verifica se há algo para atualizar
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Nenhum dado para atualizar' },
        { status: 400 }
      )
    }

    console.log('📝 Atualizando perfil com dados:', {
      hasName: !!updateData.name,
      hasProfilePicture: updateData.profilePictureUrl !== undefined,
      profilePictureValue: updateData.profilePictureUrl === null ? 'null (remover)' : updateData.profilePictureUrl ? 'nova URL' : 'não alterado',
    })

    // Tenta atualizar usando Prisma normal primeiro
    let updatedUser
    try {
      // Usa 'as any' para contornar problemas de tipo se Prisma Client não foi regenerado
      updatedUser = await prisma.user.update({
        where: { id: session.user.id },
        data: updateData as any,
        select: {
          id: true,
          name: true,
          email: true,
          profilePictureUrl: true as any,
        },
      })
    } catch (prismaError: any) {
      // Se Prisma falhar, tenta usar SQL direto com validação
      console.log('⚠️ Prisma falhou, tentando SQL direto...', prismaError.message)
      
      // Valida que os dados são seguros antes de usar SQL
      const userId = session.user.id
      if (!userId || userId.length > 100) {
        throw new Error('ID de usuário inválido')
      }

      const setClauses: string[] = []
      
      if (updateData.name) {
        // Valida nome (máximo 255 caracteres, apenas caracteres seguros)
        const safeName = updateData.name.substring(0, 255).replace(/[^a-zA-Z0-9\s\-_.,áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g, '')
        setClauses.push(`"name" = $1`)
      }

      if (updateData.profilePictureUrl !== undefined) {
        if (updateData.profilePictureUrl === null) {
          setClauses.push(`"profilePictureUrl" = NULL`)
        } else {
          // Valida URL (máximo 500 caracteres, deve ser URL válida)
          const safeUrl = updateData.profilePictureUrl.substring(0, 500)
          if (!safeUrl.startsWith('http://') && !safeUrl.startsWith('https://')) {
            throw new Error('URL inválida')
          }
          setClauses.push(`"profilePictureUrl" = $2`)
        }
      }

      if (setClauses.length === 0) {
        throw new Error('Nenhum dado para atualizar')
      }

      // Monta SQL com validação de segurança
      let sql = `UPDATE "User" SET `
      const updates: string[] = []
      
      if (updateData.name) {
        const safeName = updateData.name.replace(/'/g, "''")
        updates.push(`"name" = '${safeName}'`)
      }
      
      if (updateData.profilePictureUrl !== undefined) {
        if (updateData.profilePictureUrl === null) {
          updates.push(`"profilePictureUrl" = NULL`)
        } else {
          const safeUrl = updateData.profilePictureUrl.replace(/'/g, "''")
          updates.push(`"profilePictureUrl" = '${safeUrl}'`)
        }
      }
      
      sql += updates.join(', ')
      const safeUserId = userId.replace(/'/g, "''")
      sql += ` WHERE id = '${safeUserId}' RETURNING id, name, email, "profilePictureUrl";`

      const result = await prisma.$queryRawUnsafe(sql) as Array<{
        id: string
        name: string
        email: string
        profilePictureUrl: string | null
      }>

      if (result.length === 0) {
        throw new Error('Usuário não encontrado')
      }

      updatedUser = result[0]
    }

    return NextResponse.json(updatedUser)
  } catch (error: any) {
    console.error('❌ Erro ao atualizar perfil:', error)
    console.error('📋 Detalhes do erro:', {
      code: error?.code,
      message: error?.message,
      meta: error?.meta,
      stack: error?.stack,
    })
    
    // Se for erro de coluna não encontrada, tenta criar e retornar erro informativo
    if (error?.code === 'P2022' || 
        error?.code === 'P2010' ||
        error?.message?.includes('profilePictureUrl') ||
        error?.message?.includes('does not exist') ||
        error?.message?.includes('Unknown column')) {
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "User" 
          ADD COLUMN IF NOT EXISTS "profilePictureUrl" TEXT;
        `)
        console.log('✅ Coluna profilePictureUrl criada após erro')
        
        return NextResponse.json(
          { error: 'A coluna foi criada. Por favor, tente novamente.' },
          { status: 500 }
        )
      } catch (createError: any) {
        console.error('Erro ao criar coluna:', createError)
        return NextResponse.json(
          { error: 'Erro ao criar coluna profilePictureUrl. Execute a migration manualmente.' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { error: `Erro ao atualizar perfil: ${error.message || 'Erro desconhecido'}` },
      { status: 500 }
    )
  }
}

