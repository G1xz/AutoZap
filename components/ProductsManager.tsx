'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'
import { ShoppingBag, Package, Calendar, User, DollarSign, Truck, Store, CreditCard } from 'lucide-react'

interface OrderItem {
  id: string
  productId: string
  productType: string
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  notes: string | null
}

interface Order {
  id: string
  contactNumber: string
  contactName: string | null
  deliveryType: string
  deliveryAddress: string | null
  status: string
  totalAmount: number
  paymentMethod: string | null
  paymentLink: string | null
  paymentPixKey: string | null
  notes: string | null
  createdAt: string
  completedAt: string | null
  instance: {
    id: string
    name: string
  }
  items: OrderItem[]
}

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  ready: 'Pronto',
  delivered: 'Entregue',
  picked_up: 'Retirado',
  cancelled: 'Cancelado',
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-purple-100 text-purple-800',
  ready: 'bg-green-100 text-green-800',
  delivered: 'bg-green-100 text-green-800',
  picked_up: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function ProductsManager() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined)

  useEffect(() => {
    fetchOrders()
  }, [filterStatus])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const url = filterStatus ? `/api/orders?status=${filterStatus}` : '/api/orders'
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setOrders(data.orders || [])
      } else {
        toast.error('Erro ao carregar pedidos')
      }
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error)
      toast.error('Erro ao buscar pedidos')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCurrency = (value: number | null) => {
    if (!value) return 'N/A'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const totalOrders = orders.length
  const totalValue = orders.reduce((sum, order) => sum + order.totalAmount, 0)
  const uniqueProducts = new Set(
    orders.flatMap(order => order.items.map(item => item.productName))
  ).size

  if (loading) {
    return <div className="text-center py-8">Carregando pedidos...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <ShoppingBag size={24} />
            Pedidos
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Visualize todos os pedidos realizados pelos seus clientes
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus(undefined)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filterStatus === undefined
                ? 'bg-autozap-primary text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filterStatus === 'pending'
                ? 'bg-autozap-primary text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Pendentes
          </button>
          <button
            onClick={() => setFilterStatus('confirmed')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filterStatus === 'confirmed'
                ? 'bg-autozap-primary text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Confirmados
          </button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex items-center gap-3">
          <ShoppingBag className="text-autozap-primary" size={24} />
          <div>
            <div className="text-sm text-gray-600 mb-1">Total de Pedidos</div>
            <div className="text-2xl font-bold text-gray-900">{totalOrders}</div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex items-center gap-3">
          <DollarSign className="text-green-600" size={24} />
          <div>
            <div className="text-sm text-gray-600 mb-1">Valor Total</div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalValue)}</div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex items-center gap-3">
          <Package className="text-blue-600" size={24} />
          <div>
            <div className="text-sm text-gray-600 mb-1">Produtos Únicos</div>
            <div className="text-2xl font-bold text-blue-600">{uniqueProducts}</div>
          </div>
        </div>
      </div>

      {/* Lista de Pedidos */}
      {orders.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <Package size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">
            {filterStatus
              ? `Nenhum pedido com status "${statusLabels[filterStatus] || filterStatus}" encontrado.`
              : 'Nenhum pedido encontrado.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        Pedido #{order.id.slice(-8)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(order.createdAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {order.deliveryType === 'delivery' ? (
                        <Truck size={16} className="text-blue-600" />
                      ) : (
                        <Store size={16} className="text-green-600" />
                      )}
                      <span className="text-sm text-gray-700">
                        {order.deliveryType === 'delivery' ? 'Entrega' : 'Retirada'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Total</div>
                      <div className="text-lg font-bold text-gray-900">
                        {formatCurrency(order.totalAmount)}
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full ${
                        statusColors[order.status] || statusColors.pending
                      }`}
                    >
                      {statusLabels[order.status] || order.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4">
                {/* Itens do Pedido */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Itens do Pedido:</h4>
                  <div className="space-y-2">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {item.productName}
                            {item.quantity > 1 && (
                              <span className="text-gray-500 ml-2">x{item.quantity}</span>
                            )}
                          </div>
                          {item.notes && (
                            <div className="text-xs text-gray-500 mt-1">📝 {item.notes}</div>
                          )}
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(item.totalPrice)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Informações do Cliente */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Cliente</div>
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-gray-400" />
                      <span className="text-sm text-gray-900">
                        {order.contactName || order.contactNumber}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Instância</div>
                    <span className="text-sm text-gray-900">{order.instance.name}</span>
                  </div>
                </div>

                {/* Endereço de Entrega */}
                {order.deliveryType === 'delivery' && order.deliveryAddress && (
                  <div className="mb-4">
                    <div className="text-xs text-gray-500 mb-1">Endereço de Entrega</div>
                    <div className="flex items-start gap-2">
                      <Truck size={14} className="text-gray-400 mt-0.5" />
                      <span className="text-sm text-gray-900">{order.deliveryAddress}</span>
                    </div>
                  </div>
                )}

                {/* Informações de Pagamento */}
                {(order.paymentLink || order.paymentPixKey || order.paymentMethod) && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-2">Pagamento</div>
                    <div className="flex items-center gap-2">
                      <CreditCard size={14} className="text-gray-400" />
                      <div className="text-sm text-gray-900">
                        {order.paymentMethod === 'gateway' && order.paymentLink && (
                          <a
                            href={order.paymentLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Link de Pagamento
                          </a>
                        )}
                        {order.paymentMethod === 'pix' && order.paymentPixKey && (
                          <span>Pix: {order.paymentPixKey}</span>
                        )}
                        {order.paymentMethod === 'cash' && (
                          <span>Pagamento na retirada/entrega</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Observações */}
                {order.notes && (
                  <div className="mb-4">
                    <div className="text-xs text-gray-500 mb-1">Observações</div>
                    <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                      {order.notes}
                    </div>
                  </div>
                )}

                {/* Data de Conclusão */}
                {order.completedAt && (
                  <div className="text-xs text-gray-500">
                    Concluído em: {formatDate(order.completedAt)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
