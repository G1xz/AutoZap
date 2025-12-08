'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { ShoppingBag, Package, Calendar, User, DollarSign, Truck, Store, CreditCard, Clock, CheckCircle2, XCircle } from 'lucide-react'

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

export default function OrdersManager() {
    const { data: session } = useSession()
    const [loading, setLoading] = useState(true)
    const [orders, setOrders] = useState<Order[]>([])
    const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined)
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const [productImages, setProductImages] = useState<Record<string, string>>({})

    useEffect(() => {
        fetchOrders()
    }, [filterStatus])

    const fetchProductImages = async (items: OrderItem[]) => {
        const imageMap: Record<string, string> = {}
        
        // Agrupa itens por productId e productType para evitar buscas duplicadas
        const uniqueProducts = new Map<string, OrderItem>()
        items.forEach(item => {
            const key = `${item.productType}-${item.productId}`
            if (!uniqueProducts.has(key)) {
                uniqueProducts.set(key, item)
            }
        })
        
        // Busca imagens para cada produto único
        for (const [key, item] of Array.from(uniqueProducts.entries())) {
            try {
                if (item.productType === 'catalog') {
                    // Busca imagem do catálogo
                    const response = await fetch(`/api/catalogs/node/${item.productId}`)
                    if (response.ok) {
                        const nodeData = await response.json()
                        if (nodeData.imageUrl) {
                            imageMap[key] = nodeData.imageUrl
                        }
                    }
                } else if (item.productType === 'service') {
                    // Busca imagem do serviço
                    const response = await fetch(`/api/services/${item.productId}`)
                    if (response.ok) {
                        const serviceData = await response.json()
                        if (serviceData.imageUrl) {
                            imageMap[key] = serviceData.imageUrl
                        }
                    }
                }
            } catch (error) {
                console.error(`Erro ao buscar imagem do produto ${item.productId}:`, error)
            }
        }
        
        setProductImages(imageMap)
    }

    const fetchOrders = async () => {
        setLoading(true)
        try {
            const url = filterStatus ? `/api/orders?status=${filterStatus}` : '/api/orders'
            const response = await fetch(url)
            if (response.ok) {
                const data = await response.json()
                const ordersData = data.orders || []
                setOrders(ordersData)
                
                // Busca imagens de todos os produtos de todos os pedidos
                const allItems = ordersData.flatMap((order: Order) => order.items)
                await fetchProductImages(allItems)
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

    const updateOrderStatus = async (orderId: string, newStatus: string) => {
        try {
            const response = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            })

            if (response.ok) {
                toast.success('Status atualizado com sucesso')
                fetchOrders()
                setSelectedOrder(null)
            } else {
                toast.error('Erro ao atualizar status')
            }
        } catch (error) {
            console.error('Erro ao atualizar status:', error)
            toast.error('Erro ao atualizar status')
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

    const formatPhone = (phone: string) => {
        const cleaned = phone.replace(/\D/g, '')
        if (cleaned.length === 13) {
            return cleaned.replace(/^55(\d{2})(\d{5})(\d{4})$/, '+55 ($1) $2-$3')
        }
        return phone
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
        <div className="h-full flex flex-col">
            {/* Cabeçalho fixo */}
            <div className="flex-shrink-0 pb-4 border-b border-gray-200 mb-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                            <ShoppingBag size={24} />
                            Pedidos
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Gerencie os pedidos dos seus clientes
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilterStatus(undefined)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterStatus === undefined
                                ? 'bg-autozap-primary text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setFilterStatus('pending')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterStatus === 'pending'
                                ? 'bg-autozap-primary text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                        >
                            Pendentes
                        </button>
                        <button
                            onClick={() => setFilterStatus('confirmed')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterStatus === 'confirmed'
                                ? 'bg-autozap-primary text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                        >
                            Confirmados
                        </button>
                    </div>
                </div>
            </div>

            {/* Estatísticas fixas */}
            <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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

            {/* Lista de Pedidos - Scrollável */}
            <div className="flex-1 overflow-y-auto min-h-0">
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
                    <div className="space-y-4 pr-2">
                        {orders.map((order) => (
                        <div
                            key={order.id}
                            className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => setSelectedOrder(order)}
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
                                            className={`px-3 py-1 text-xs font-medium rounded-full ${statusColors[order.status] || statusColors.pending
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
                                        {order.items.map((item) => {
                                            const imageKey = `${item.productType}-${item.productId}`
                                            const imageUrl = productImages[imageKey]
                                            
                                            return (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0"
                                                >
                                                    {imageUrl ? (
                                                        <div className="flex-shrink-0 w-12 h-12 rounded-md overflow-hidden bg-gray-100">
                                                            <img 
                                                                src={imageUrl} 
                                                                alt={item.productName}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="flex-shrink-0 w-12 h-12 rounded-md bg-gray-100 flex items-center justify-center">
                                                            <Package size={20} className="text-gray-400" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
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
                                                    <div className="text-sm font-medium text-gray-900 flex-shrink-0">
                                                        {formatCurrency(item.totalPrice)}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Informações do Cliente */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <div className="text-xs text-gray-500 mb-1">Cliente</div>
                                        <div className="flex items-center gap-2">
                                            <User size={14} className="text-gray-400" />
                                            <span className="text-sm text-gray-900">
                                                {order.contactName || formatPhone(order.contactNumber)}
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
                                                        onClick={(e) => e.stopPropagation()}
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

            {/* Modal de detalhes do pedido */}
            {selectedOrder && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedOrder(null)}
                >
                    <div
                        className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-semibold">Pedido #{selectedOrder.id.slice(-8)}</h3>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Criado em {formatDate(selectedOrder.createdAt)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedOrder(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <XCircle size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Status */}
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">
                                    Status do Pedido
                                </label>
                                <select
                                    value={selectedOrder.status}
                                    onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-autozap-primary"
                                >
                                    <option value="pending">Pendente</option>
                                    <option value="confirmed">Confirmado</option>
                                    <option value="preparing">Preparando</option>
                                    <option value="ready">Pronto</option>
                                    <option value="delivered">Entregue</option>
                                    <option value="picked_up">Retirado</option>
                                    <option value="cancelled">Cancelado</option>
                                </select>
                            </div>

                            {/* Informações do Cliente */}
                            <div>
                                <h4 className="font-semibold mb-2">Cliente</h4>
                                <div className="space-y-1 text-sm">
                                    <p>
                                        <span className="text-gray-600">Nome:</span>{' '}
                                        {selectedOrder.contactName || 'Não informado'}
                                    </p>
                                    <p>
                                        <span className="text-gray-600">Telefone:</span>{' '}
                                        {formatPhone(selectedOrder.contactNumber)}
                                    </p>
                                    <p>
                                        <span className="text-gray-600">Instância:</span> {selectedOrder.instance.name}
                                    </p>
                                </div>
                            </div>

                            {/* Itens do Pedido */}
                            <div>
                                <h4 className="font-semibold mb-2">Itens do Pedido</h4>
                                <div className="space-y-2">
                                    {selectedOrder.items.map((item) => (
                                        <div
                                            key={item.id}
                                            className="flex justify-between items-start p-3 bg-gray-50 rounded-lg"
                                        >
                                            <div className="flex-1">
                                                <p className="font-medium">{item.productName}</p>
                                                <p className="text-sm text-gray-600">
                                                    {item.quantity}x {formatCurrency(item.unitPrice)}
                                                </p>
                                                {item.notes && (
                                                    <p className="text-sm text-gray-500 italic mt-1">Obs: {item.notes}</p>
                                                )}
                                            </div>
                                            <p className="font-semibold">{formatCurrency(item.totalPrice)}</p>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center pt-3 border-t-2 border-gray-200">
                                        <span className="font-semibold">Total</span>
                                        <span className="text-lg font-bold text-green-600">
                                            {formatCurrency(selectedOrder.totalAmount)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Entrega */}
                            <div>
                                <h4 className="font-semibold mb-2">Entrega</h4>
                                <div className="space-y-1 text-sm">
                                    <p>
                                        <span className="text-gray-600">Tipo:</span>{' '}
                                        {selectedOrder.deliveryType === 'delivery'
                                            ? 'Entrega'
                                            : 'Retirada no estabelecimento'}
                                    </p>
                                    {selectedOrder.deliveryAddress && (
                                        <div className="flex items-start gap-2 mt-2 p-3 bg-blue-50 rounded-lg">
                                            <Truck className="h-4 w-4 text-blue-600 mt-0.5" />
                                            <p className="text-sm">{selectedOrder.deliveryAddress}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Pagamento */}
                            <div>
                                <h4 className="font-semibold mb-2">Pagamento</h4>
                                <div className="space-y-1 text-sm">
                                    <p>
                                        <span className="text-gray-600">Método:</span>{' '}
                                        {selectedOrder.paymentMethod === 'pix'
                                            ? 'Pix'
                                            : selectedOrder.paymentMethod === 'gateway'
                                                ? 'Gateway de Pagamento'
                                                : 'Dinheiro'}
                                    </p>
                                    {selectedOrder.paymentPixKey && (
                                        <div className="mt-2 p-3 bg-green-50 rounded-lg">
                                            <p className="text-sm font-mono">{selectedOrder.paymentPixKey}</p>
                                        </div>
                                    )}
                                    {selectedOrder.paymentLink && (
                                        <div className="mt-2">
                                            <a
                                                href={selectedOrder.paymentLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:underline text-sm"
                                            >
                                                Abrir link de pagamento →
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Observações */}
                            {selectedOrder.notes && (
                                <div>
                                    <h4 className="font-semibold mb-2">Observações</h4>
                                    <p className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">
                                        {selectedOrder.notes}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
