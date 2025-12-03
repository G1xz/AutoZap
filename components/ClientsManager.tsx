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

interface CartItem {
  productId: string
  productType: string
  productName: string
  quantity: number
  unitPrice: number
  notes?: string
}

interface Cart {
  instanceId: string
  contactNumber: string
  items: CartItem[]
  updatedAt: string
}

interface Order {
  id: string
  status: string
  totalAmount: number
  deliveryType: string
  createdAt: string
  items: CartItem[]
}

export default function ClientsManager() {
  const { data: session } = useSession()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [cartData, setCartData] = useState<{ cart: Cart; orders: Order[]; hasActiveCart: boolean; hasOrders: boolean } | null>(null)
  const [loadingCart, setLoadingCart] = useState(false)

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

  const handleViewCart = async (client: Client) => {
    setSelectedClient(client)
    setLoadingCart(true)
    try {
      const normalizedContact = client.contactNumber.replace(/\D/g, '')
      const response = await fetch(`/api/clients/${client.instanceId}/${normalizedContact}/cart`)
      if (response.ok) {
        const data = await response.json()
        setCartData(data)
      } else {
        console.error('Erro ao buscar carrinho')
        setCartData(null)
      }
    } catch (error) {
      console.error('Erro ao buscar carrinho:', error)
      setCartData(null)
    } finally {
      setLoadingCart(false)
    }
  }

  const closeCartModal = () => {
    setSelectedClient(null)
    setCartData(null)
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

                <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 mb-2">
                  <span>{client.messageCount} mensagens</span>
                  <span>
                    {new Date(client.lastMessageDate).toLocaleDateString('pt-BR')}
                  </span>
                </div>

                <button
                  onClick={() => handleViewCart(client)}
                  className="w-full mt-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                >
                  Ver Carrinho
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal do Carrinho */}
      {selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Carrinho - {selectedClient.contactName || formatPhoneNumber(selectedClient.contactNumber)}
              </h3>
              <button
                onClick={closeCartModal}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {loadingCart ? (
                <div className="text-center py-8">Carregando carrinho...</div>
              ) : cartData ? (
                <div className="space-y-6">
                  {/* Carrinho Ativo */}
                  {cartData.hasActiveCart && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                        Carrinho Ativo
                      </h4>
                      <div className="border border-gray-200 rounded-lg p-4">
                        {cartData.cart.items.length === 0 ? (
                          <p className="text-gray-500 text-sm">Carrinho vazio</p>
                        ) : (
                          <div className="space-y-3">
                            {cartData.cart.items.map((item, index) => (
                              <div key={index} className="flex justify-between items-start pb-3 border-b border-gray-100 last:border-0">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{item.productName}</p>
                                  <p className="text-sm text-gray-600">
                                    {item.quantity}x R$ {item.unitPrice.toFixed(2).replace('.', ',')}
                                  </p>
                                  {item.notes && (
                                    <p className="text-xs text-gray-500 mt-1">Obs: {item.notes}</p>
                                  )}
                                </div>
                                <p className="font-semibold text-gray-900">
                                  R$ {(item.quantity * item.unitPrice).toFixed(2).replace('.', ',')}
                                </p>
                              </div>
                            ))}
                            <div className="pt-3 border-t border-gray-200">
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-gray-900">Total:</span>
                                <span className="font-bold text-lg text-gray-900">
                                  R$ {cartData.cart.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0).toFixed(2).replace('.', ',')}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mt-3">
                          Atualizado em: {new Date(cartData.cart.updatedAt).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Pedidos */}
                  {cartData.hasOrders && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-900 mb-3">
                        Pedidos ({cartData.orders.length})
                      </h4>
                      <div className="space-y-3">
                        {cartData.orders.map((order) => (
                          <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <p className="font-medium text-gray-900">Pedido #{order.id.slice(0, 8)}</p>
                                <p className="text-sm text-gray-600">
                                  {new Date(order.createdAt).toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <span className={`px-2 py-1 rounded text-xs ${
                                order.status === 'completed' ? 'bg-green-100 text-green-800' :
                                order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {order.status === 'completed' ? 'Concluído' :
                                 order.status === 'pending' ? 'Pendente' :
                                 order.status === 'cancelled' ? 'Cancelado' : order.status}
                              </span>
                            </div>
                            <div className="space-y-2 mb-3">
                              {order.items.map((item, index) => (
                                <div key={index} className="flex justify-between text-sm">
                                  <span className="text-gray-700">{item.productName} x{item.quantity}</span>
                                  <span className="text-gray-900">R$ {(item.quantity * item.unitPrice).toFixed(2).replace('.', ',')}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                              <span className="text-sm text-gray-600">
                                {order.deliveryType === 'delivery' ? 'Entrega' : 'Retirada'}
                              </span>
                              <span className="font-semibold text-gray-900">
                                Total: R$ {order.totalAmount.toFixed(2).replace('.', ',')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!cartData.hasActiveCart && !cartData.hasOrders && (
                    <div className="text-center py-8 text-gray-500">
                      <p>Nenhum carrinho ativo ou pedido encontrado para este cliente.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>Erro ao carregar carrinho.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

