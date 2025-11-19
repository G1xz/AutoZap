'use client'

import { useEffect, useState } from 'react'

interface AutomationRule {
  id: string
  name: string
  trigger: string
  response: string
  isActive: boolean
  priority: number
  instanceId: string | null
}

interface WhatsAppInstance {
  id: string
  name: string
  status: string
}

export default function AutomationRulesManager() {
  const { toast } = useToast()
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [instances, setInstances] = useState<WhatsAppInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    trigger: '',
    response: '',
    isActive: true,
    priority: 0,
    instanceId: '',
  })

  useEffect(() => {
    fetchRules()
    fetchInstances()
  }, [])

  const fetchRules = async () => {
    try {
      const response = await fetch('/api/automation/rules')
      if (response.ok) {
        const data = await response.json()
        setRules(data)
      }
    } catch (error) {
      console.error('Erro ao buscar regras:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchInstances = async () => {
    try {
      const response = await fetch('/api/whatsapp/instances')
      if (response.ok) {
        const data = await response.json()
        setInstances(data)
      }
    } catch (error) {
      console.error('Erro ao buscar instâncias:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingRule
        ? `/api/automation/rules/${editingRule.id}`
        : '/api/automation/rules'
      const method = editingRule ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          instanceId: formData.instanceId || null,
        }),
      })

      if (response.ok) {
        setShowForm(false)
        setEditingRule(null)
        setFormData({
          name: '',
          trigger: '',
          response: '',
          isActive: true,
          priority: 0,
          instanceId: '',
        })
        fetchRules()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Erro ao salvar regra')
      }
    } catch (error) {
      console.error('Erro ao salvar regra:', error)
      toast.error('Erro ao salvar regra')
    }
  }

  const handleEdit = (rule: AutomationRule) => {
    setEditingRule(rule)
    setFormData({
      name: rule.name,
      trigger: rule.trigger,
      response: rule.response,
      isActive: rule.isActive,
      priority: rule.priority,
      instanceId: rule.instanceId || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Excluir regra',
      description: 'Tem certeza que deseja excluir esta regra?',
      variant: 'destructive',
    })
    if (!confirmed) return

    try {
      const response = await fetch(`/api/automation/rules/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchRules()
      }
    } catch (error) {
      console.error('Erro ao excluir regra:', error)
    }
  }

  const toggleRuleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/automation/rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      })

      if (response.ok) {
        fetchRules()
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
        <h2 className="text-xl font-semibold">Regras de Automação</h2>
        <button
          onClick={() => {
            setShowForm(true)
            setEditingRule(null)
            setFormData({
              name: '',
              trigger: '',
              response: '',
              isActive: true,
              priority: 0,
              instanceId: '',
            })
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          Nova Regra
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingRule ? 'Editar Regra' : 'Nova Regra'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome da Regra
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                placeholder="Ex: Resposta de Boas-vindas"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Palavra-chave ou Padrão (Trigger)
              </label>
              <input
                type="text"
                value={formData.trigger}
                onChange={(e) =>
                  setFormData({ ...formData, trigger: e.target.value })
                }
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                placeholder="Ex: olá, oi, bom dia"
              />
              <p className="mt-1 text-xs text-gray-500">
                A regra será acionada quando a mensagem contiver esta palavra
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resposta Automática
              </label>
              <textarea
                value={formData.response}
                onChange={(e) =>
                  setFormData({ ...formData, response: e.target.value })
                }
                required
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                placeholder="Mensagem que será enviada automaticamente"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instância (opcional)
                </label>
                <select
                  value={formData.instanceId}
                  onChange={(e) =>
                    setFormData({ ...formData, instanceId: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Todas as instâncias</option>
                  {instances
                    .filter((inst) => inst.status === 'connected')
                    .map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prioridade
                </label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Regras com maior prioridade são verificadas primeiro
                </p>
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData({ ...formData, isActive: e.target.checked })
                }
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                Regra ativa
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                {editingRule ? 'Atualizar' : 'Criar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingRule(null)
                }}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {rules.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            Nenhuma regra criada ainda. Crie uma regra para começar a automação.
          </p>
        ) : (
          rules.map((rule) => (
            <div
              key={rule.id}
              className="border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{rule.name}</h3>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        rule.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {rule.isActive ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    <strong>Trigger:</strong> {rule.trigger}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    <strong>Resposta:</strong> {rule.response}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Prioridade: {rule.priority}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleRuleStatus(rule.id, rule.isActive)}
                    className={`px-3 py-1 rounded text-sm ${
                      rule.isActive
                        ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {rule.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    onClick={() => handleEdit(rule)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
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




