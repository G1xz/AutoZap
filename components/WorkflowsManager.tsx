'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'

interface Workflow {
  id: string
  name: string
  description?: string
  trigger: string
  isActive: boolean
  usesAI: boolean
  isAIOnly?: boolean
  createdAt: string
  instance?: {
    id: string
    name: string
    status: string
  }
}

export default function WorkflowsManager() {
  const router = useRouter()
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWorkflows()
  }, [])

  const fetchWorkflows = async () => {
    try {
      const response = await fetch('/api/workflows')
      if (response.ok) {
        const data = await response.json()
        // Garante que usesAI sempre seja um boolean
        const workflowsWithAI = data.map((w: any) => ({
          ...w,
          usesAI: w.usesAI ?? false,
        }))
        setWorkflows(workflowsWithAI)
      }
    } catch (error) {
      console.error('Erro ao buscar workflows:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Excluir fluxo',
      description: 'Tem certeza que deseja excluir este fluxo? Esta ação não pode ser desfeita.',
      variant: 'destructive',
    })
    if (!confirmed) return

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

  // Separa workflows manuais dos que usam IA
  const manualWorkflows = workflows.filter((w) => !(w.isAIOnly ?? false) && !(w.usesAI ?? false))
  const aiWorkflows = workflows.filter((w) => (w.isAIOnly ?? false) || (w.usesAI ?? false))

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Fluxos de Automação</h2>
        <button
          onClick={() => router.push('/dashboard/workflows/new')}
          className="w-full sm:w-auto px-4 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-light transition-colors text-sm sm:text-base"
        >
          Novo Fluxo
        </button>
      </div>

      {/* Fluxos com IA */}
      {aiWorkflows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <h3 className="text-lg font-semibold text-gray-900">Fluxos com Inteligência Artificial</h3>
            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
              {aiWorkflows.length}
            </span>
          </div>
          <div className="space-y-4">
            {aiWorkflows.map((workflow) => (
              <div
                key={workflow.id}
                className="border-2 border-purple-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white shadow-sm"
              >
                <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-0">
                  <div className="flex-1 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-base sm:text-lg text-gray-900">{workflow.name}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        workflow.isAIOnly 
                          ? 'bg-purple-200 text-purple-800' 
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {workflow.isAIOnly ? '🤖 IA Autônoma' : '🤖 Com IA'}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          workflow.isActive
                            ? 'bg-autozap-light text-autozap-dark'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        {workflow.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    {workflow.description && (
                      <p className="text-sm text-gray-600 mt-1">{workflow.description}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">
                      <strong>Trigger:</strong> {workflow.trigger}
                    </p>
                    {workflow.instance && (
                      <p className="text-xs text-gray-500 mt-1">
                        Conta: {workflow.instance.name}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Criado em: {new Date(workflow.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => router.push(`/dashboard/workflows/${workflow.id}`)}
                      className="flex-1 sm:flex-none px-3 py-1.5 bg-autozap-primary text-white rounded text-sm hover:bg-autozap-light transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => toggleWorkflowStatus(workflow.id, workflow.isActive)}
                      className={`flex-1 sm:flex-none px-3 py-1.5 rounded text-sm transition-colors ${
                        workflow.isActive
                          ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                          : 'bg-autozap-primary text-white hover:bg-autozap-light'
                      }`}
                    >
                      {workflow.isActive ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      onClick={() => handleDelete(workflow.id)}
                      className="flex-1 sm:flex-none px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fluxos Manuais */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚙️</span>
          <h3 className="text-lg font-semibold text-gray-900">Fluxos Manuais</h3>
          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
            {manualWorkflows.length}
          </span>
        </div>
      <div className="space-y-4">
          {manualWorkflows.length === 0 && aiWorkflows.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            Nenhum fluxo criado ainda. Crie um fluxo para começar a automação visual.
          </p>
          ) : manualWorkflows.length === 0 ? (
            <p className="text-center text-gray-500 py-4">
              Nenhum fluxo manual criado ainda.
            </p>
        ) : (
            manualWorkflows.map((workflow) => (
            <div
              key={workflow.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white shadow-sm"
            >
              <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-0">
                <div className="flex-1 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-base sm:text-lg text-gray-900">{workflow.name}</h3>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        workflow.isActive
                          ? 'bg-autozap-light text-autozap-dark'
                          : 'bg-gray-200 text-gray-800'
                      }`}
                    >
                      {workflow.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  {workflow.description && (
                    <p className="text-sm text-gray-600 mt-1">{workflow.description}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    <strong>Trigger:</strong> {workflow.trigger}
                  </p>
                  {workflow.instance && (
                    <p className="text-xs text-gray-500 mt-1">
                      Conta: {workflow.instance.name}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Criado em: {new Date(workflow.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => router.push(`/dashboard/workflows/${workflow.id}`)}
                    className="flex-1 sm:flex-none px-3 py-1.5 bg-autozap-primary text-white rounded text-sm hover:bg-autozap-light transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => toggleWorkflowStatus(workflow.id, workflow.isActive)}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded text-sm transition-colors ${
                      workflow.isActive
                        ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                        : 'bg-autozap-primary text-white hover:bg-autozap-light'
                    }`}
                  >
                    {workflow.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    onClick={() => handleDelete(workflow.id)}
                    className="flex-1 sm:flex-none px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
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
      <ConfirmDialog />
    </div>
  )
}

