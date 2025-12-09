'use client'

import { useCallback, useState, useEffect, useRef } from 'react'
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

import ProductNode from './nodes/ProductNode'
import ServiceNode from './nodes/ServiceNode'
import CategoryNode from './nodes/CategoryNode'
import CatalogNode from './nodes/CatalogNode'

const nodeTypes: NodeTypes = {
  product: ProductNode as any,
  service: ServiceNode as any,
  category: CategoryNode as any,
  catalog: CatalogNode as any,
}

interface CatalogEditorProps {
  catalogId?: string
  onSave?: (catalog: any) => void
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

export default function CatalogEditor({ catalogId, onSave }: CatalogEditorProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [catalogName, setCatalogName] = useState('')
  const [catalogDescription, setCatalogDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showNodeMenu, setShowNodeMenu] = useState(false)
  const [nodeMenuPosition, setNodeMenuPosition] = useState({ x: 0, y: 0 })
  const [canvasNodePosition, setCanvasNodePosition] = useState({ x: 0, y: 0 })
  const [getCenterPosition, setGetCenterPosition] = useState<(() => { x: number; y: number }) | null>(null)

  // Carregar catálogo existente
  useEffect(() => {
    if (catalogId) {
      loadCatalog(catalogId)
    }
  }, [catalogId])

  const loadCatalog = async (id: string) => {
    try {
      const response = await fetch(`/api/catalogs/${id}`)
      if (response.ok) {
        const catalog = await response.json()
        setCatalogName(catalog.name)
        setCatalogDescription(catalog.description || '')
        
        // Converter nós do banco para formato ReactFlow
        const flowNodes: Node[] = catalog.nodes.map((node: any) => ({
          id: node.id,
          type: node.type,
          position: { x: node.positionX, y: node.positionY },
          data: JSON.parse(node.data),
        }))
        
        // Converter conexões do banco para formato ReactFlow
        const flowEdges: Edge[] = catalog.connections.map((conn: any) => ({
          id: conn.id,
          source: conn.sourceNodeId,
          target: conn.targetNodeId,
          sourceHandle: conn.sourceHandle || undefined,
          targetHandle: conn.targetHandle || undefined,
        }))
        
        setNodes(flowNodes)
        setEdges(flowEdges)
      }
    } catch (error) {
      console.error('Erro ao carregar catálogo:', error)
    }
  }

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds))
    },
    [setEdges]
  )

  const addNode = (type: CatalogNodeType) => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: canvasNodePosition,
      data: getDefaultNodeData(type),
    }
    setNodes((nds) => [...nds, newNode])
    setShowNodeMenu(false)
  }

  const getDefaultNodeData = (type: CatalogNodeType): any => {
    switch (type) {
      case 'catalog':
        return { label: 'Catálogo', name: '', description: '', imageUrl: '' }
      case 'product':
        return { label: 'Produto', name: '', description: '', price: undefined, imageUrl: '' }
      case 'service':
        return { label: 'Serviço', name: '', description: '', price: undefined, imageUrl: '', requiresAppointment: false, appointmentDuration: undefined }
      case 'category':
        return { label: 'Categoria', name: '', description: '' }
      default:
        return { label: type }
    }
  }

  const handlePaneContextMenu = (event: MouseEvent | React.MouseEvent, position: { x: number; y: number }) => {
    event.preventDefault()
    setCanvasNodePosition(position)
    setNodeMenuPosition({ x: event.clientX, y: event.clientY })
    setShowNodeMenu(true)
  }

  const handlePaneClick = () => {
    setShowNodeMenu(false)
  }

  const handleSave = async () => {
    if (!catalogName.trim()) {
      toast.error('Preencha o nome do catálogo')
      return
    }

    setIsSaving(true)
    try {
      const catalogData = {
        id: catalogId,
        name: catalogName,
        description: catalogDescription,
        isActive: true,
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.type,
          positionX: node.position.x,
          positionY: node.position.y,
          data: JSON.stringify(node.data),
        })),
        edges: edges.map((edge) => ({
          sourceNodeId: edge.source,
          targetNodeId: edge.target,
          sourceHandle: edge.sourceHandle || null,
          targetHandle: edge.targetHandle || null,
        })),
      }

      const url = catalogId ? `/api/catalogs/${catalogId}` : '/api/catalogs'
      const method = catalogId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(catalogData),
      })

      if (response.ok) {
        const saved = await response.json()
        toast.success('Catálogo salvo com sucesso!')
        if (onSave) {
          onSave(saved)
        } else {
          router.push('/dashboard/catalogo')
        }
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Erro ao salvar catálogo')
      }
    } catch (error) {
      console.error('Erro ao salvar catálogo:', error)
      toast.error('Erro ao salvar catálogo')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col bg-gray-50 z-10">
      {/* Barra superior */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between shadow-sm">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/dashboard/catalogo')}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition-colors"
            >
              ← Voltar
            </button>
            <input
              type="text"
              value={catalogName}
              onChange={(e) => setCatalogName(e.target.value)}
              placeholder="Nome do Catálogo"
              className="flex-1 text-xl font-semibold border-none outline-none bg-transparent text-gray-900 placeholder-gray-400"
            />
          </div>
          <input
            type="text"
            value={catalogDescription}
            onChange={(e) => setCatalogDescription(e.target.value)}
            placeholder="Descrição do catálogo (opcional)"
            className="text-sm text-gray-600 border-none outline-none w-full bg-transparent placeholder-gray-400"
          />
        </div>
        <div className="flex gap-2 ml-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-light disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Salvando...' : 'Salvar Catálogo'}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative bg-gray-50">
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
              Adicionar Item:
            </div>
            <button
              onClick={() => addNode('catalog')}
              className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm text-gray-900 transition-colors font-medium"
            >
              📋 Catálogo (Principal)
            </button>
            <div className="border-t border-gray-200 my-1"></div>
            <button
              onClick={() => addNode('category')}
              className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm text-gray-900 transition-colors"
            >
              📁 Categoria
            </button>
            <button
              onClick={() => addNode('product')}
              className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm text-gray-900 transition-colors"
            >
              📦 Produto
            </button>
            <button
              onClick={() => addNode('service')}
              className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm text-gray-900 transition-colors"
            >
              🛠️ Serviço
            </button>
          </div>
        )}
      </div>

      {/* Painel lateral */}
      <div className="bg-gray-50 border-t border-gray-200 p-4 flex items-center justify-center">
        <div className="text-xs text-gray-600">
          💡 Dica: Clique com o botão direito no canvas para adicionar itens
        </div>
      </div>
    </div>
  )
}

// Tipo auxiliar
type CatalogNodeType = 'product' | 'service' | 'category' | 'catalog'

