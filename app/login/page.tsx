'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isRegister) {
        const response = await fetch('/api/users/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Erro ao criar conta')
        }

        // Após registro, fazer login automaticamente
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        })

        if (result?.error) {
          throw new Error('Erro ao fazer login após registro')
        }

        router.push('/dashboard')
      } else {
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        })

        if (result?.error) {
          throw new Error('Email ou senha incorretos')
        }

        router.push('/dashboard')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-autozap-light/20 to-autozap-primary/20">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md border border-autozap-gray-medium">
        <h1 className="text-3xl font-bold text-center mb-6 text-autozap-primary">
          WhatsApp Automation
        </h1>
        
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setIsRegister(false)}
            className={`flex-1 py-2 px-4 rounded transition-colors ${
              !isRegister
                ? 'bg-autozap-primary text-white hover:bg-autozap-light'
                : 'bg-autozap-gray-medium text-white hover:bg-autozap-gray-dark'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setIsRegister(true)}
            className={`flex-1 py-2 px-4 rounded transition-colors ${
              isRegister
                ? 'bg-autozap-primary text-white hover:bg-autozap-light'
                : 'bg-autozap-gray-medium text-white hover:bg-autozap-gray-dark'
            }`}
          >
            Registrar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-autozap-gray-dark mb-1">
                Nome
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-autozap-gray-medium rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent text-autozap-gray-dark"
                placeholder="Seu nome"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-autozap-gray-dark mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-autozap-gray-medium rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent text-autozap-gray-dark"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-autozap-gray-dark mb-1">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 border border-autozap-gray-medium rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent text-autozap-gray-dark"
              placeholder="••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-autozap-primary text-white py-2 px-4 rounded-md hover:bg-autozap-light focus:outline-none focus:ring-2 focus:ring-autozap-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Carregando...' : isRegister ? 'Criar Conta' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}



