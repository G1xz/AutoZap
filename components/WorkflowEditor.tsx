'use client'

import { useCallback, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Connection,
  Edge,
  Node,
  NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import MessageNode from './nodes/MessageNode'
import WaitNode from './nodes/WaitNode'
import QuestionnaireNode from './nodes/QuestionnaireNode'
import AINode from './nodes/AINode'
import ConditionNode from './nodes/ConditionNode'
import TriggerNode from './nodes/TriggerNode'
import TransferToHumanNode from './nodes/TransferToHumanNode'
import CloseChatNode from './nodes/CloseChatNode'
import AIWorkflowConfig from './AIWorkflowConfig'

const nodeTypes: NodeTypes = {
  trigger: TriggerNode as any,
  message: MessageNode as any,
  wait: WaitNode as any,
  questionnaire: QuestionnaireNode as any,
  ai: AINode as any,
  condition: ConditionNode as any,
  transfer_to_human: TransferToHumanNode as any,
  close_chat: CloseChatNode as any,
}

interface WorkflowEditorProps {
  workflowId?: string
  onSave?: (workflow: any) => void
}

// Componente interno que usa useReactFlow para calcular posições
function FlowCanvasWrapper({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onPaneClick,
  onPaneContextMenu,
  nodeTypes,
  onGetCenterPosition,
}: {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: any
  onEdgesChange: any
  onConnect: (params: Connection) => void
  onPaneClick: () => void
  onPaneContextMenu: (event: React.MouseEvent, position: { x: number; y: number }) => void
  nodeTypes: NodeTypes
  onGetCenterPosition: (getCenter: () => { x: number; y: number }) => void
}) {
  const { screenToFlowPosition } = useReactFlow()

  const handlePaneContextMenu = (event: MouseEvent | React.MouseEvent) => {
    event.preventDefault()
    const clientX = 'clientX' in event ? event.clientX : (event as MouseEvent).clientX
    const clientY = 'clientY' in event ? event.clientY : (event as MouseEvent).clientY
    const position = screenToFlowPosition({
      x: clientX,
      y: clientY,
    })
    onPaneContextMenu(event as React.MouseEvent, position)
  }

  // Expõe função para obter posição central do viewport
  useEffect(() => {
    const getCenter = () => {
      const viewport = document.querySelector('.react-flow__viewport')
      if (viewport) {
        const rect = viewport.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        return screenToFlowPosition({
          x: centerX,
          y: centerY,
        })
      }
      return { x: 400, y: 300 }
    }
    onGetCenterPosition(getCenter)
  }, [screenToFlowPosition, onGetCenterPosition])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onPaneClick={onPaneClick}
      onPaneContextMenu={handlePaneContextMenu}
      nodeTypes={nodeTypes}
      fitView
    >
      <Background color="#e5e7eb" gap={16} />
      <Controls />
      <MiniMap 
        nodeColor="#e5e7eb"
        maskColor="rgba(0, 0, 0, 0.1)"
      />
    </ReactFlow>
  )
}

export default function WorkflowEditor({ workflowId, onSave }: WorkflowEditorProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [workflowName, setWorkflowName] = useState('')
  const [workflowTrigger, setWorkflowTrigger] = useState('')
  const [workflowDescription, setWorkflowDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showNodeMenu, setShowNodeMenu] = useState(false)
  const [nodeMenuPosition, setNodeMenuPosition] = useState({ x: 0, y: 0 })
  const [canvasNodePosition, setCanvasNodePosition] = useState({ x: 0, y: 0 })
  const [getCenterPosition, setGetCenterPosition] = useState<(() => { x: number; y: number }) | null>(null)
  const [isAIOnly, setIsAIOnly] = useState<boolean | null>(null) // null = não escolhido ainda, true = IA-only, false = manual
  const [aiBusinessDetails, setAiBusinessDetails] = useState<any>(null)

  // Carregar workflow existente
  useEffect(() => {
    if (workflowId) {
      loadWorkflow(workflowId)
    }
    // Se não há workflowId, não criar nó inicial ainda - aguardar escolha do tipo
  }, [workflowId])

  const loadWorkflow = async (id: string) => {
    try {
      const response = await fetch(`/api/workflows/${id}`)
      if (response.ok) {
        const workflow = await response.json()
        setWorkflowName(workflow.name)
        setWorkflowTrigger(workflow.trigger)
        setWorkflowDescription(workflow.description || '')
        setIsAIOnly(workflow.isAIOnly ?? false)
        
        if (workflow.isAIOnly && workflow.aiBusinessDetails) {
          try {
            setAiBusinessDetails(JSON.parse(workflow.aiBusinessDetails))
          } catch {
            setAiBusinessDetails(null)
          }
        }
        
        // Se não for IA-only, carregar nós normalmente
        if (!workflow.isAIOnly) {
          // Converter nós do banco para formato ReactFlow
          const flowNodes: Node[] = workflow.nodes.map((node: any) => ({
            id: node.id,
            type: node.type,
            position: { x: node.positionX, y: node.positionY },
            data: JSON.parse(node.data),
          }))
        
          // Converter conexões do banco para formato ReactFlow
          const flowEdges: Edge[] = workflow.connections.map((conn: any) => ({
            id: conn.id,
            source: conn.sourceNodeId,
            target: conn.targetNodeId,
            sourceHandle: conn.sourceHandle || undefined,
            targetHandle: conn.targetHandle || undefined,
          }))
        
          setNodes(flowNodes)
          setEdges(flowEdges)
        }
      }
    } catch (error) {
      console.error('Erro ao carregar workflow:', error)
    }
  }

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds))
    },
    [setEdges]
  )

  const addNode = (type: NodeType) => {
    // Usa a posição do canvas salva quando o menu foi aberto
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: canvasNodePosition,
      data: getDefaultNodeData(type),
    }
    setNodes((nds) => [...nds, newNode])
    setShowNodeMenu(false)
  }

  const getDefaultNodeData = (type: NodeType): any => {
    switch (type) {
      case 'message':
        return { label: 'Mensagem', message: '', fileUrl: '', fileName: '', fileType: 'image' }
      case 'wait':
        return { label: 'Aguardar', duration: 60, unit: 'seconds' }
      case 'questionnaire':
        return { label: 'Questionário', question: '', options: [] }
      case 'ai':
        return { label: 'IA', prompt: '', systemPrompt: '' }
      case 'condition':
        return { label: 'Condição', condition: '' }
      case 'transfer_to_human':
        return { label: 'Transferir para Atendente', message: 'Nossa equipe entrará em contato em breve. Aguarde um momento, por favor.' }
      case 'close_chat':
        return { label: 'Encerrar Chat', message: 'Obrigado pelo contato! Esta conversa foi encerrada. Se precisar de mais alguma coisa, é só nos chamar novamente.' }
      default:
        return { label: type }
    }
  }

  const handlePaneContextMenu = (event: MouseEvent | React.MouseEvent, position: { x: number; y: number }) => {
    event.preventDefault()
    // Salva posição do canvas para criar o nó (onde o usuário clicou)
    setCanvasNodePosition(position)
    // Posição do menu na tela (exatamente onde o mouse está)
    setNodeMenuPosition({ x: event.clientX, y: event.clientY })
    setShowNodeMenu(true)
  }

  const handlePaneClick = () => {
    // Fechar menu ao clicar fora
    setShowNodeMenu(false)
  }

  const handleSave = async () => {
    if (!workflowName.trim() || !workflowTrigger.trim()) {
      toast.error('Preencha o nome e o trigger do fluxo')
      return
    }

    if (isAIOnly === null) {
      toast.error('Escolha o tipo de fluxo primeiro')
      return
    }

    if (isAIOnly && !aiBusinessDetails) {
      toast.error('Configure os detalhes do negócio para o fluxo de IA')
      return
    }

    setIsSaving(true)
    try {
      const workflowData: any = {
        id: workflowId,
        name: workflowName,
        description: workflowDescription,
        trigger: workflowTrigger,
        isActive: true,
        isAIOnly: isAIOnly ?? false,
        usesAI: isAIOnly ?? false,
      }

      if (isAIOnly) {
        // Para fluxos IA-only, não precisa de nós e edges
        workflowData.nodes = []
        workflowData.edges = []
        workflowData.aiBusinessDetails = JSON.stringify(aiBusinessDetails)
      } else {
        // Para fluxos manuais, incluir nós e edges normalmente
        workflowData.nodes = nodes.map((node) => ({
          id: node.id,
          type: node.type,
          positionX: node.position.x,
          positionY: node.position.y,
          data: JSON.stringify(node.data),
        }))
        workflowData.edges = edges.map((edge) => ({
          sourceNodeId: edge.source,
          targetNodeId: edge.target,
          sourceHandle: edge.sourceHandle || null,
          targetHandle: edge.targetHandle || null,
        }))
      }

      const url = workflowId ? `/api/workflows/${workflowId}` : '/api/workflows'
      const method = workflowId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflowData),
      })

      if (response.ok) {
        const saved = await response.json()
        toast.success('Fluxo salvo com sucesso!')
        if (onSave) {
          onSave(saved)
        } else {
          // Navegar para a página de fluxos se não houver callback
          router.push('/dashboard/fluxos')
        }
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.details 
          ? `${errorData.error}: ${errorData.details}` 
          : errorData.error || 'Erro ao salvar fluxo'
        console.error('Erro ao salvar workflow:', errorData)
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error('Erro ao salvar workflow:', error)
      toast.error('Erro ao salvar fluxo')
    } finally {
      setIsSaving(false)
    }
  }

  // Tela de escolha do tipo de workflow (apenas para novos workflows)
  if (!workflowId && isAIOnly === null) {
    return (
      <div className="fixed inset-0 w-full h-full flex flex-col bg-gray-50 z-10">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Escolha o Tipo de Fluxo
              </h1>
              <p className="text-gray-600">
                Selecione como você quer que seu fluxo funcione
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Fluxo Manual */}
              <button
                onClick={() => {
                  setIsAIOnly(false)
                  // Criar nó inicial (trigger) para fluxo manual
                  const initialNode: Node = {
                    id: 'trigger-1',
                    type: 'trigger',
                    position: { x: 250, y: 100 },
                    data: { label: 'Início', trigger: '' },
                  }
                  setNodes([initialNode])
                }}
                className="p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-autozap-primary hover:shadow-lg transition-all text-left"
              >
                <div className="text-4xl mb-4">⚙️</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Fluxo Manual
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  Crie fluxos personalizados com nós de mensagens, questionários, condições e mais. Controle total sobre cada etapa.
                </p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>✓ Mensagens personalizadas</li>
                  <li>✓ Questionários e botões</li>
                  <li>✓ Condições e lógica</li>
                  <li>✓ Controle total</li>
                </ul>
              </button>

              {/* Fluxo com IA */}
              <button
                onClick={() => setIsAIOnly(true)}
                className="p-6 bg-white border-2 border-purple-200 rounded-lg hover:border-purple-400 hover:shadow-lg transition-all text-left"
              >
                <div className="text-4xl mb-4">🤖</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Fluxo com Inteligência Artificial
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  Configure os detalhes do seu negócio e deixe a IA conversar de forma inteligente e natural com seus clientes.
                </p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>✓ Conversação natural</li>
                  <li>✓ Respostas inteligentes</li>
                  <li>✓ Contexto automático</li>
                  <li>✓ Configuração simples</li>
                </ul>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col bg-gray-50 z-10">
      {/* Barra superior */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between shadow-sm">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/dashboard/fluxos')}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition-colors"
            >
              ← Voltar
            </button>
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Nome do Fluxo"
              className="flex-1 text-xl font-semibold border-none outline-none bg-transparent text-gray-900 placeholder-gray-400"
            />
          </div>
          <input
            type="text"
            value={workflowTrigger}
            onChange={(e) => {
              setWorkflowTrigger(e.target.value)
              // Atualiza o trigger no nó inicial se existir
              setNodes((nds) =>
                nds.map((node) =>
                  node.type === 'trigger'
                    ? { ...node, data: { ...node.data, trigger: e.target.value } }
                    : node
                )
              )
            }}
            placeholder="Palavra-chave que inicia este fluxo (ex: olá, oi)"
            className="text-sm text-gray-600 border-none outline-none w-full bg-transparent placeholder-gray-400"
          />
        </div>
        <div className="flex gap-2 ml-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-light disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Salvando...' : 'Salvar Fluxo'}
          </button>
        </div>
      </div>

      {/* Canvas ou Configuração de IA */}
      <div className="flex-1 relative bg-gray-50 overflow-auto">
        {isAIOnly ? (
          // Mostrar configuração de IA para fluxos IA-only
          <div className="h-full overflow-auto">
            <AIWorkflowConfig
              businessDetails={aiBusinessDetails}
              onSave={(details) => {
                setAiBusinessDetails(details)
                toast.success('Detalhes do negócio salvos! Agora salve o fluxo.')
              }}
            />
          </div>
        ) : (
          // Mostrar canvas para fluxos manuais
          <ReactFlowProvider>
            <FlowCanvasWrapper
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onPaneClick={handlePaneClick}
              onPaneContextMenu={handlePaneContextMenu}
              nodeTypes={nodeTypes}
              onGetCenterPosition={setGetCenterPosition}
            />
          </ReactFlowProvider>
        )}

        {/* Menu de adicionar nó */}
        {showNodeMenu && (
          <div
            className="fixed bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-50"
            style={{ 
              left: `${nodeMenuPosition.x}px`, 
              top: `${nodeMenuPosition.y}px`,
            }}
          >
            <div className="text-xs font-semibold text-gray-900 mb-2 px-2">
              Adicionar Nó:
            </div>
            <button
              onClick={() => addNode('message')}
              className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm text-gray-900 transition-colors"
            >
              💬 Mensagem
            </button>
            <button
              onClick={() => addNode('wait')}
              className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm text-gray-900 transition-colors"
            >
              ⏱️ Aguardar
            </button>
            <button
              onClick={() => addNode('questionnaire')}
              className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm text-gray-900 transition-colors"
            >
              ❓ Questionário
            </button>
            {/* Não permitir nó de IA em fluxos manuais */}
            {isAIOnly === false && (
              <button
                onClick={() => addNode('ai')}
                className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm text-gray-900 transition-colors"
              >
                🤖 IA
              </button>
            )}
            <button
              onClick={() => addNode('condition')}
              className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm text-gray-900 transition-colors"
            >
              🔀 Condição
            </button>
            <button
              onClick={() => addNode('transfer_to_human')}
              className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm text-gray-900 transition-colors"
            >
              👤 Transferir para Atendente
            </button>
            <button
              onClick={() => addNode('close_chat')}
              className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm text-gray-900 transition-colors"
            >
              ✓ Encerrar Chat
            </button>
          </div>
        )}
      </div>

      {/* Painel lateral */}
      <div className="bg-gray-50 border-t border-gray-200 p-4 flex items-center justify-center">
        <div className="text-xs text-gray-600">
          💡 Dica: Clique com o botão direito no canvas para adicionar nós
        </div>
      </div>
    </div>
  )
}

// Tipo auxiliar
type NodeType = 'message' | 'wait' | 'questionnaire' | 'ai' | 'condition' | 'trigger' | 'transfer_to_human' | 'close_chat'
