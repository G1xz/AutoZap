import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import FacebookProvider from 'next-auth/providers/facebook'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      }
    }),
    // Facebook Provider para conectar WhatsApp via OAuth
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID || '',
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
      authorization: {
        params: {
          scope: [
            'business_management',
            'whatsapp_business_management',
            'whatsapp_business_messaging',
          ].join(','),
        },
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.name = user.name
        token.email = user.email
      }
      
      // Se updateSession foi chamado, busca dados atualizados do banco
      if (trigger === 'update' && token.id) {
        try {
          const updatedUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              id: true,
              name: true,
              email: true,
            },
          })
          
          if (updatedUser) {
            token.name = updatedUser.name
            token.email = updatedUser.email
          }
        } catch (error) {
          console.error('Erro ao atualizar token JWT:', error)
        }
      }
      
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.name = (token.name as string) || session.user.name
        session.user.email = (token.email as string) || session.user.email
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}




