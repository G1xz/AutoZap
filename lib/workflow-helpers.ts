/**
 * Helpers para workflows
 * Funções auxiliares para processamento de workflows
 */

import { log } from './logger'

/**
 * Normaliza texto para comparação (remove acentos, espaços extras, etc)
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s]/g, '') // Remove caracteres especiais
    .replace(/\s+/g, ' ') // Normaliza espaços
    .trim()
}

/**
 * Verifica se um texto corresponde a um trigger
 */
export function matchesTrigger(text: string, trigger: string): boolean {
  const normalizedText = normalizeText(text)
  const normalizedTrigger = normalizeText(trigger)
  
  return normalizedText.includes(normalizedTrigger)
}

/**
 * Substitui variáveis no texto
 */
export function replaceVariables(
  text: string,
  variables: Record<string, any>
): string {
  if (!text) return text

  let result = text

  // Substitui variáveis do formato {{variavel}}
  result = result.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    const value = variables[varName.toLowerCase()]
    return value !== undefined ? String(value) : match
  })

  // Adiciona variáveis de data/hora
  const now = new Date()
  const dateStr = now.toLocaleDateString('pt-BR')
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  result = result.replace(/\{\{data\}\}/g, dateStr)
  result = result.replace(/\{\{hora\}\}/g, timeStr)
  result = result.replace(/\{\{datahora\}\}/g, `${dateStr} às ${timeStr}`)

  return result
}

/**
 * Valida estrutura de workflow
 */
export function validateWorkflowStructure(workflow: {
  nodes: any[]
  connections: any[]
}): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Deve ter pelo menos um nó trigger
  const hasTrigger = workflow.nodes.some((n) => n.type === 'trigger')
  if (!hasTrigger) {
    errors.push('Workflow deve ter pelo menos um nó trigger')
  }

  // Valida conexões
  const nodeIds = new Set(workflow.nodes.map((n) => n.id))
  for (const conn of workflow.connections) {
    if (!nodeIds.has(conn.sourceNodeId)) {
      errors.push(`Conexão referencia nó de origem inexistente: ${conn.sourceNodeId}`)
    }
    if (!nodeIds.has(conn.targetNodeId)) {
      errors.push(`Conexão referencia nó de destino inexistente: ${conn.targetNodeId}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Encontra o nó inicial (trigger) de um workflow
 */
export function findTriggerNode(workflow: { nodes: any[] }): any | null {
  return workflow.nodes.find((n) => n.type === 'trigger') || null
}

/**
 * Encontra nós conectados a um nó específico
 */
export function findConnectedNodes(
  nodeId: string,
  connections: Array<{ sourceNodeId: string; targetNodeId: string }>
): string[] {
  return connections
    .filter((c) => c.sourceNodeId === nodeId)
    .map((c) => c.targetNodeId)
}

/**
 * Obtém caminho completo de um nó até o final do workflow
 */
export function getNodePath(
  startNodeId: string,
  workflow: {
    nodes: any[]
    connections: Array<{ sourceNodeId: string; targetNodeId: string }>
  }
): string[] {
  const path: string[] = [startNodeId]
  const visited = new Set<string>([startNodeId])

  let current = startNodeId
  while (true) {
    const next = findConnectedNodes(current, workflow.connections)
    if (next.length === 0) break

    // Pega o primeiro nó não visitado
    const nextNode = next.find((n) => !visited.has(n))
    if (!nextNode) break

    path.push(nextNode)
    visited.add(nextNode)
    current = nextNode
  }

  return path
}

