'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface LogEntry {
  timestamp: string
  level: string
  message: string
  data?: any
}

export default function DebugPage() {
  const { data: session } = useSession()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (!session) return

    const fetchLogs = async () => {
      try {
        const response = await fetch('/api/debug/logs')
        if (response.ok) {
          const data = await response.json()
          // Em produção, você pode receber logs reais aqui
        }
      } catch (error) {
        console.error('Erro ao buscar logs:', error)
      }
    }

    if (autoRefresh) {
      fetchLogs()
      const interval = setInterval(fetchLogs, 2000) // Atualiza a cada 2 segundos
      return () => clearInterval(interval)
    }
  }, [session, autoRefresh])

  const filteredLogs = logs.filter(log => 
    filter === '' || 
    log.message.toLowerCase().includes(filter.toLowerCase()) ||
    log.level.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Debug - Logs do Sistema</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ Importante:</strong> Os logs aparecem no console do servidor onde o Next.js está rodando.
        </p>
        <p className="text-sm text-yellow-700 mt-2">
          Para ver os logs em tempo real:
        </p>
        <ul className="text-sm text-yellow-700 mt-2 list-disc list-inside">
          <li><strong>Desenvolvimento local:</strong> Veja o terminal onde você rodou <code className="bg-yellow-100 px-1 rounded">npm run dev</code></li>
          <li><strong>Produção (Vercel):</strong> Acesse o dashboard da Vercel → Seu projeto → Logs</li>
          <li><strong>Produção (outros):</strong> Veja os logs do servidor onde a aplicação está rodando</li>
        </ul>
      </div>

      <div>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar logs (ex: 'carrinho', 'add_to_cart', 'checkout')..."
          className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent bg-white text-gray-900 placeholder-gray-400"
        />
      </div>

      {filteredLogs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-500">
            Nenhum log encontrado. Os logs aparecem no console do servidor.
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Configure um serviço de logs (como Logtail, Datadog, ou similar) para ver logs aqui.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="max-h-[600px] overflow-y-auto">
            <div className="divide-y divide-gray-200">
              {filteredLogs.map((log, index) => (
                <div key={index} className="p-3 hover:bg-gray-50">
                  <div className="flex items-start gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      log.level === 'error' ? 'bg-red-100 text-red-800' :
                      log.level === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                      log.level === 'info' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {log.level}
                    </span>
                    <span className="text-xs text-gray-500">{log.timestamp}</span>
                  </div>
                  <p className="text-sm text-gray-900 mt-1 font-mono">{log.message}</p>
                  {log.data && (
                    <pre className="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>💡 Dica:</strong> Para debug do carrinho, procure por logs que começam com <code className="bg-blue-100 px-1 rounded">🛒</code>
        </p>
        <p className="text-sm text-blue-700 mt-2">
          Exemplos de logs importantes:
        </p>
        <ul className="text-sm text-blue-700 mt-2 list-disc list-inside">
          <li><code>🛒 [add_to_cart]</code> - Quando um item é adicionado</li>
          <li><code>🛒 [getCart]</code> - Quando o carrinho é buscado</li>
          <li><code>🛒 [checkout]</code> - Quando o pedido é finalizado</li>
          <li><code>🔧 handleFunctionCall</code> - Quando uma função é chamada pela IA</li>
        </ul>
      </div>
    </div>
  )
}

