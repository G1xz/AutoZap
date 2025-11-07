'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface Client {
  contactNumber: string
  contactName: string | null
  instanceId: string
  instanceName: string
  lastMessageDate: string
  messageCount: number
  status?: string
}

export default function ClientsManager() {
  const { data: session } = useSession()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients')
      if (response.ok) {
        const data = await response.json()
        setClients(data)
      }
    } catch (error) {
      console.error('Erro ao buscar clientes:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatPhoneNumber = (phone: string) => {
    // Remove caracteres não numéricos
    const cleaned = phone.replace(/\D/g, '')
    // Formata como (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`
    } else if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`
    }
    return phone
  }

  const filteredClients = clients.filter(client => {
    const searchLower = searchTerm.toLowerCase()
    const name = client.contactName?.toLowerCase() || ''
    const number = client.contactNumber.toLowerCase()
    return name.includes(searchLower) || number.includes(searchLower)
  })

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Clientes</h2>
      </div>

      {/* Busca */}
      <div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por nome ou número..."
          className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent bg-white text-gray-900 placeholder-gray-400"
        />
      </div>

      {/* Lista de clientes */}
      <div className="space-y-3 sm:space-y-4">
        {filteredClients.length === 0 ? (
          <p className="text-center text-gray-500 py-8 text-sm sm:text-base">
            {searchTerm ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredClients.map((client) => (
              <div
                key={`${client.instanceId}-${client.contactNumber}`}
                className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2 sm:mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base sm:text-lg text-gray-900 mb-1 truncate">
                      {client.contactName || 'Sem nome'}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">{formatPhoneNumber(client.contactNumber)}</p>
                    <p className="text-xs text-gray-500 mt-1 truncate">Conta: {client.instanceName}</p>
                  </div>
                  {client.status && (
                    <span className={`px-2 py-1 rounded text-xs flex-shrink-0 ml-2 ${
                      client.status === 'active' ? 'bg-green-100 text-green-800' :
                      client.status === 'waiting_human' ? 'bg-yellow-100 text-yellow-800' :
                      client.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {client.status === 'active' ? 'Ativo' :
                       client.status === 'waiting_human' ? 'Aguardando' :
                       client.status === 'closed' ? 'Encerrado' : client.status}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600">
                  <span>{client.messageCount} mensagens</span>
                  <span>
                    {new Date(client.lastMessageDate).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

