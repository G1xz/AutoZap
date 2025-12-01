'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Package, Truck, MapPin, CreditCard, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface OrderItem {
    id: string
    productName: string
    quantity: number
    unitPrice: number
    totalPrice: number
    notes?: string
}

interface Order {
    id: string
    contactNumber: string
    contactName?: string
    deliveryType: 'pickup' | 'delivery'
    deliveryAddress?: string
    status: string
    totalAmount: number
    paymentMethod?: string
    paymentLink?: string
    paymentPixKey?: string
    notes?: string
    createdAt: string
    completedAt?: string
    items: OrderItem[]
    instance: {
        id: string
        name: string
    }
}

const statusConfig = {
    pending: { label: 'Pendente', color: 'bg-yellow-500', icon: Clock },
    confirmed: { label: 'Confirmado', color: 'bg-blue-500', icon: CheckCircle2 },
    preparing: { label: 'Preparando', color: 'bg-purple-500', icon: Package },
    ready: { label: 'Pronto', color: 'bg-green-500', icon: CheckCircle2 },
    delivered: { label: 'Entregue', color: 'bg-green-700', icon: Truck },
    picked_up: { label: 'Retirado', color: 'bg-green-700', icon: CheckCircle2 },
    cancelled: { label: 'Cancelado', color: 'bg-red-500', icon: XCircle },
}

export default function OrdersManager() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const [statusFilter, setStatusFilter] = useState<string>('all')

    useEffect(() => {
        fetchOrders()
    }, [statusFilter])

    const fetchOrders = async () => {
        try {
            setLoading(true)
            const url = statusFilter === 'all'
                ? '/api/orders'
                : `/api/orders?status=${statusFilter}`

            const response = await fetch(url)
            const data = await response.json()

            if (response.ok) {
                setOrders(data.orders || [])
            } else {
                toast.error('Erro ao carregar pedidos')
            }
        } catch (error) {
            console.error('Erro ao buscar pedidos:', error)
            toast.error('Erro ao carregar pedidos')
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

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value)
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    const formatPhone = (phone: string) => {
        const cleaned = phone.replace(/\D/g, '')
        if (cleaned.length === 13) {
            return cleaned.replace(/^55(\d{2})(\d{5})(\d{4})$/, '+55 ($1) $2-$3')
        }
        return phone
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Pedidos</h1>
                    <p className="text-gray-500 mt-1">Gerencie os pedidos dos seus clientes</p>
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="confirmed">Confirmado</SelectItem>
                        <SelectItem value="preparing">Preparando</SelectItem>
                        <SelectItem value="ready">Pronto</SelectItem>
                        <SelectItem value="delivered">Entregue</SelectItem>
                        <SelectItem value="picked_up">Retirado</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {orders.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Package className="h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-gray-500 text-center">
                            {statusFilter === 'all'
                                ? 'Nenhum pedido encontrado'
                                : `Nenhum pedido ${statusConfig[statusFilter as keyof typeof statusConfig]?.label.toLowerCase()} encontrado`
                            }
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {orders.map((order) => {
                        const StatusIcon = statusConfig[order.status as keyof typeof statusConfig]?.icon || AlertCircle
                        const statusInfo = statusConfig[order.status as keyof typeof statusConfig] || {
                            label: order.status,
                            color: 'bg-gray-500',
                            icon: AlertCircle,
                        }

                        return (
                            <Card key={order.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedOrder(order)}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <CardTitle className="text-lg">
                                                Pedido #{order.id.slice(0, 8)}
                                            </CardTitle>
                                            <CardDescription>
                                                {order.contactName || formatPhone(order.contactNumber)}
                                            </CardDescription>
                                        </div>
                                        <Badge className={`${statusInfo.color} text-white`}>
                                            <StatusIcon className="h-3 w-3 mr-1" />
                                            {statusInfo.label}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-gray-500" />
                                            <span className="text-gray-600">{formatDate(order.createdAt)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {order.deliveryType === 'delivery' ? (
                                                <Truck className="h-4 w-4 text-gray-500" />
                                            ) : (
                                                <Package className="h-4 w-4 text-gray-500" />
                                            )}
                                            <span className="text-gray-600">
                                                {order.deliveryType === 'delivery' ? 'Entrega' : 'Retirada'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <CreditCard className="h-4 w-4 text-gray-500" />
                                            <span className="text-gray-600">
                                                {order.paymentMethod === 'pix' ? 'Pix' :
                                                    order.paymentMethod === 'gateway' ? 'Gateway' : 'Dinheiro'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 font-semibold">
                                            <span className="text-gray-600">Total:</span>
                                            <span className="text-green-600">{formatCurrency(order.totalAmount)}</span>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t">
                                        <p className="text-sm text-gray-600">
                                            {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Modal de detalhes do pedido */}
            <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Detalhes do Pedido #{selectedOrder?.id.slice(0, 8)}</DialogTitle>
                        <DialogDescription>
                            Criado em {selectedOrder && formatDate(selectedOrder.createdAt)}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedOrder && (
                        <div className="space-y-6">
                            {/* Status */}
                            <div>
                                <label className="text-sm font-medium">Status do Pedido</label>
                                <Select
                                    value={selectedOrder.status}
                                    onValueChange={(value) => updateOrderStatus(selectedOrder.id, value)}
                                >
                                    <SelectTrigger className="mt-2">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">Pendente</SelectItem>
                                        <SelectItem value="confirmed">Confirmado</SelectItem>
                                        <SelectItem value="preparing">Preparando</SelectItem>
                                        <SelectItem value="ready">Pronto</SelectItem>
                                        <SelectItem value="delivered">Entregue</SelectItem>
                                        <SelectItem value="picked_up">Retirado</SelectItem>
                                        <SelectItem value="cancelled">Cancelado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Informações do Cliente */}
                            <div>
                                <h3 className="font-semibold mb-2">Cliente</h3>
                                <div className="space-y-1 text-sm">
                                    <p><span className="text-gray-600">Nome:</span> {selectedOrder.contactName || 'Não informado'}</p>
                                    <p><span className="text-gray-600">Telefone:</span> {formatPhone(selectedOrder.contactNumber)}</p>
                                    <p><span className="text-gray-600">Instância:</span> {selectedOrder.instance.name}</p>
                                </div>
                            </div>

                            {/* Itens do Pedido */}
                            <div>
                                <h3 className="font-semibold mb-2">Itens do Pedido</h3>
                                <div className="space-y-2">
                                    {selectedOrder.items.map((item) => (
                                        <div key={item.id} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
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
                                <h3 className="font-semibold mb-2">Entrega</h3>
                                <div className="space-y-1 text-sm">
                                    <p>
                                        <span className="text-gray-600">Tipo:</span>{' '}
                                        {selectedOrder.deliveryType === 'delivery' ? 'Entrega' : 'Retirada no estabelecimento'}
                                    </p>
                                    {selectedOrder.deliveryAddress && (
                                        <div className="flex items-start gap-2 mt-2 p-3 bg-blue-50 rounded-lg">
                                            <MapPin className="h-4 w-4 text-blue-600 mt-0.5" />
                                            <p className="text-sm">{selectedOrder.deliveryAddress}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Pagamento */}
                            <div>
                                <h3 className="font-semibold mb-2">Pagamento</h3>
                                <div className="space-y-1 text-sm">
                                    <p>
                                        <span className="text-gray-600">Método:</span>{' '}
                                        {selectedOrder.paymentMethod === 'pix' ? 'Pix' :
                                            selectedOrder.paymentMethod === 'gateway' ? 'Gateway de Pagamento' : 'Dinheiro'}
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
                                    <h3 className="font-semibold mb-2">Observações</h3>
                                    <p className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">
                                        {selectedOrder.notes}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
