'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'

interface Catalog {
  id: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
}

export default function ServicesManager() {
  const router = useRouter()
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const [catalogs, setCatalogs] = useState<Catalog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCatalogs()
  }, [])

  const fetchCatalogs = async () => {
    try {
      const response = await fetch('/api/catalogs')
      if (response.ok) {
        const data = await response.json()
        setCatalogs(data)
      }
    } catch (error) {
      console.error('Erro ao buscar catálogos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Excluir catálogo',
      description: 'Tem certeza que deseja excluir este catálogo? Esta ação não pode ser desfeita.',
      variant: 'destructive',
    })
    if (!confirmed) return

    try {
      const response = await fetch(`/api/catalogs/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchCatalogs()
      }
    } catch (error) {
      console.error('Erro ao excluir catálogo:', error)
    }
  }

  const toggleCatalogStatus = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/catalogs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      })

      if (response.ok) {
        fetchCatalogs()
      }
    } catch (error) {
      console.error('Erro ao alterar status:', error)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Catálogos</h2>
        <button
          onClick={() => router.push('/dashboard/catalogs/new')}
          className="px-4 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-light transition-colors"
        >
          Novo Catálogo
        </button>
      </div>

      <div className="space-y-4">
        {catalogs.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            Nenhum catálogo criado ainda. Crie um catálogo para começar.
          </p>
        ) : (
          catalogs.map((catalog) => (
            <div
              key={catalog.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg text-gray-900">{catalog.name}</h3>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        catalog.isActive
                          ? 'bg-autozap-light text-autozap-dark'
                          : 'bg-gray-200 text-gray-800'
                      }`}
                    >
                      {catalog.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  {catalog.description && (
                    <p className="text-sm text-gray-600 mt-1">{catalog.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Criado em: {new Date(catalog.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/dashboard/catalogs/${catalog.id}`)}
                    className="px-3 py-1 bg-autozap-primary text-white rounded text-sm hover:bg-autozap-light transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => toggleCatalogStatus(catalog.id, catalog.isActive)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      catalog.isActive
                        ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                        : 'bg-autozap-primary text-white hover:bg-autozap-light'
                    }`}
                  >
                    {catalog.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    onClick={() => handleDelete(catalog.id)}
                    className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <ConfirmDialog />
    </div>
  )
}

