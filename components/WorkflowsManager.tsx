'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Workflow {
  id: string
  name: string
  description?: string
  trigger: string
  isActive: boolean
  createdAt: string
  instance?: {
    id: string
    name: string
    status: string
  }
}

export default function WorkflowsManager() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchWorkflows()
  }, [])

  const fetchWorkflows = async () => {
    try {
      const response = await fetch('/api/workflows')
      if (response.ok) {
        const data = await response.json()
        setWorkflows(data)
      }
    } catch (error) {
      console.error('Erro ao buscar workflows:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este fluxo?')) return

    try {
      const response = await fetch(`/api/workflows/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchWorkflows()
      }
    } catch (error) {
      console.error('Erro ao excluir workflow:', error)
    }
  }

  const toggleWorkflowStatus = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/workflows/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      })

      if (response.ok) {
        fetchWorkflows()
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
        <h2 className="text-xl font-semibold text-autozap-white">Fluxos de Automação</h2>
        <button
          onClick={() => router.push('/dashboard/workflows/new')}
          className="px-4 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-light transition-colors"
        >
          Novo Fluxo
        </button>
      </div>

      <div className="space-y-4">
        {workflows.length === 0 ? (
          <p className="text-center text-autozap-gray-medium py-8">
            Nenhum fluxo criado ainda. Crie um fluxo para começar a automação visual.
          </p>
        ) : (
          workflows.map((workflow) => (
            <div
              key={workflow.id}
              className="border border-autozap-gray-medium rounded-lg p-4 hover:shadow-md transition-shadow bg-autozap-gray-dark"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg text-autozap-white">{workflow.name}</h3>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        workflow.isActive
                          ? 'bg-autozap-light text-autozap-dark'
                          : 'bg-autozap-gray-medium text-white'
                      }`}
                    >
                      {workflow.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  {workflow.description && (
                    <p className="text-sm text-autozap-gray-medium mt-1">{workflow.description}</p>
                  )}
                  <p className="text-sm text-autozap-gray-medium mt-1">
                    <strong>Trigger:</strong> {workflow.trigger}
                  </p>
                  {workflow.instance && (
                    <p className="text-xs text-autozap-gray-medium mt-1">
                      Instância: {workflow.instance.name}
                    </p>
                  )}
                  <p className="text-xs text-autozap-gray-medium mt-2">
                    Criado em: {new Date(workflow.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/dashboard/workflows/${workflow.id}`)}
                    className="px-3 py-1 bg-autozap-primary text-white rounded text-sm hover:bg-autozap-light transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => toggleWorkflowStatus(workflow.id, workflow.isActive)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      workflow.isActive
                        ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                        : 'bg-autozap-primary text-white hover:bg-autozap-light'
                    }`}
                  >
                    {workflow.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    onClick={() => handleDelete(workflow.id)}
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
    </div>
  )
}

