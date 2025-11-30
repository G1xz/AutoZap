'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'

interface PixKey {
  id: string
  name: string
  pixKey: string
  pixKeyType: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function PixKeysManager() {
  const { toast } = useToast()
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const [pixKeys, setPixKeys] = useState<PixKey[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    pixKey: '',
    pixKeyType: 'random' as 'cpf' | 'cnpj' | 'email' | 'phone' | 'random',
    isActive: true,
  })

  useEffect(() => {
    fetchPixKeys()
  }, [])

  const fetchPixKeys = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/pix-keys')
      if (response.ok) {
        const data = await response.json()
        setPixKeys(data.pixKeys || [])
      } else {
        toast.error('Erro ao carregar chaves Pix')
      }
    } catch (error) {
      console.error('Erro ao buscar chaves Pix:', error)
      toast.error('Erro ao carregar chaves Pix')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.pixKey.trim()) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    try {
      const url = editingId ? `/api/pix-keys/${editingId}` : '/api/pix-keys'
      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success(editingId ? 'Chave Pix atualizada com sucesso!' : 'Chave Pix criada com sucesso!')
        resetForm()
        fetchPixKeys()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Erro ao salvar chave Pix')
      }
    } catch (error) {
      console.error('Erro ao salvar chave Pix:', error)
      toast.error('Erro ao salvar chave Pix')
    }
  }

  const handleEdit = (pixKey: PixKey) => {
    setFormData({
      name: pixKey.name,
      pixKey: pixKey.pixKey,
      pixKeyType: pixKey.pixKeyType as any,
      isActive: pixKey.isActive,
    })
    setEditingId(pixKey.id)
    setIsCreating(true)
  }

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Excluir chave Pix',
      description: 'Tem certeza que deseja excluir esta chave Pix? Esta ação não pode ser desfeita.',
      variant: 'destructive',
    })
    if (!confirmed) return

    try {
      const response = await fetch(`/api/pix-keys/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Chave Pix excluída com sucesso!')
        fetchPixKeys()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Erro ao excluir chave Pix')
      }
    } catch (error) {
      console.error('Erro ao excluir chave Pix:', error)
      toast.error('Erro ao excluir chave Pix')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      pixKey: '',
      pixKeyType: 'random',
      isActive: true,
    })
    setEditingId(null)
    setIsCreating(false)
  }

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/pix-keys/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      })

      if (response.ok) {
        toast.success('Status atualizado com sucesso!')
        fetchPixKeys()
      } else {
        toast.error('Erro ao atualizar status')
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      toast.error('Erro ao atualizar status')
    }
  }

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Chaves Pix</h3>
        <button
          onClick={() => {
            resetForm()
            setIsCreating(true)
          }}
          className="px-4 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-light transition-colors"
        >
          {isCreating ? 'Cancelar' : 'Nova Chave Pix'}
        </button>
      </div>

      {isCreating && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="text-md font-semibold text-gray-900 mb-4">
            {editingId ? 'Editar Chave Pix' : 'Nova Chave Pix'}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome/Identificação <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Pix Principal, Pix Vendas..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Chave <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.pixKeyType}
                onChange={(e) => setFormData({ ...formData, pixKeyType: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
              >
                <option value="random">Chave Aleatória</option>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="email">E-mail</option>
                <option value="phone">Telefone</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chave Pix <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.pixKey}
                onChange={(e) => setFormData({ ...formData, pixKey: e.target.value })}
                placeholder="Digite a chave Pix..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-autozap-primary focus:ring-autozap-primary"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Ativa
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-light transition-colors"
              >
                {editingId ? 'Atualizar' : 'Criar'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {pixKeys.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            Nenhuma chave Pix cadastrada. Clique em "Nova Chave Pix" para começar.
          </p>
        ) : (
          pixKeys.map((pixKey) => (
            <div
              key={pixKey.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-lg text-gray-900">{pixKey.name}</h4>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        pixKey.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-200 text-gray-800'
                      }`}
                    >
                      {pixKey.isActive ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Tipo:</span>{' '}
                      {pixKey.pixKeyType === 'random' && 'Chave Aleatória'}
                      {pixKey.pixKeyType === 'cpf' && 'CPF'}
                      {pixKey.pixKeyType === 'cnpj' && 'CNPJ'}
                      {pixKey.pixKeyType === 'email' && 'E-mail'}
                      {pixKey.pixKeyType === 'phone' && 'Telefone'}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Chave:</span> {pixKey.pixKey}
                    </p>
                    <p className="text-xs text-gray-500">
                      Criada em: {new Date(pixKey.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(pixKey)}
                    className="px-3 py-1 bg-autozap-primary text-white rounded text-sm hover:bg-autozap-light transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => toggleStatus(pixKey.id, pixKey.isActive)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      pixKey.isActive
                        ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {pixKey.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    onClick={() => handleDelete(pixKey.id)}
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

