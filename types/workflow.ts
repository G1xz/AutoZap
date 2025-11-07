// Tipos para o sistema de fluxos

export type NodeType = 'message' | 'wait' | 'questionnaire' | 'ai' | 'condition' | 'trigger' | 'transfer_to_human' | 'close_chat'

export interface NodeData {
  label: string
  [key: string]: any // Dados específicos de cada tipo de nó
}

// Dados específicos para cada tipo de nó
export interface MessageNodeData extends NodeData {
  message: string
  imageUrl?: string
  imageFile?: File
}

export interface WaitNodeData extends NodeData {
  duration: number // em segundos
  unit: 'seconds' | 'minutes' | 'hours'
}

export interface QuestionnaireNodeData extends NodeData {
  question: string
  options: Array<{ id: string; label: string; nextNodeId?: string }>
}

export interface AINodeData extends NodeData {
  prompt: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
}

export interface ConditionNodeData extends NodeData {
  condition: string // expressão que será avaliada
  trueLabel?: string
  falseLabel?: string
}

export interface WorkflowNode {
  id: string
  type: NodeType
  position: { x: number; y: number }
  data: NodeData
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export interface Workflow {
  id?: string
  name: string
  description?: string
  trigger: string
  isActive: boolean
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}


