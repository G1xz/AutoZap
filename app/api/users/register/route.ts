import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { registerSchema, validate } from '@/lib/validations'
import { handleError, ConflictError } from '@/lib/errors'
import { rateLimitMiddleware } from '@/lib/rate-limiter'
import { log } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    await rateLimitMiddleware(request, 'auth')

    const body = await request.json()
    const { name, email, password } = validate(registerSchema, body)

    // Verifica se usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existingUser) {
      throw new ConflictError('Email já está em uso')
    }

    // Cria usuário
    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    })

    log.event('user_registered', { userId: user.id, email: user.email })

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    const handled = handleError(error)
    return NextResponse.json(
      { error: handled.message, ...(handled.fields && { fields: handled.fields }) },
      { status: handled.statusCode }
    )
  }
}




