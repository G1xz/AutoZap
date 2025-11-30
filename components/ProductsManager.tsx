'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'
import { ShoppingBag, Package, Calendar, User, DollarSign } from 'lucide-react'

interface PurchasedProduct {
  id: string
  contactNumber: string
  productName: string
  productType: string
  interestType: string
  status: string
  convertedAt: string | null
  createdAt: string
  lastInteraction: string
  instance: {
    id: string
    name: string
  }
  service: {
    id: string
    name: string
    description: string | null
    price: number | null
    imageUrl: string | null
  } | null
}

export default function ProductsManager() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<PurchasedProduct[]>([])
  const [filterStatus, setFilterStatus] = useState<'converted' | 'all'>('converted')

  useEffect(() => {
    fetchProducts()
  }, [filterStatus])

  const fetchProducts = async () => {
    try {
      const response = await fetch(`/api/products/purchased?status=${filterStatus}`)
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products || [])
      } else {
        toast.error('Erro ao carregar produtos comprados')
      }
    } catch (error) {
      console.error('Erro ao buscar produtos:', error)
      toast.error('Erro ao buscar produtos comprados')
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

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>
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
            onClick={() => setFilterStatus('converted')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filterStatus === 'converted'
                ? 'bg-autozap-primary text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Comprados
          </button>
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filterStatus === 'all'
                ? 'bg-autozap-primary text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Todos
          </button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Total de Pedidos</div>
          <div className="text-2xl font-bold text-gray-900">
            {products.filter(p => p.status === 'converted').length}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Valor Total</div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(
              products
                .filter(p => p.status === 'converted' && p.service?.price)
                .reduce((sum, p) => sum + (p.service?.price || 0), 0)
            )}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Produtos Únicos</div>
          <div className="text-2xl font-bold text-blue-600">
            {new Set(products.filter(p => p.status === 'converted').map(p => p.productName)).size}
          </div>
        </div>
      </div>

      {/* Lista de produtos */}
      {products.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <Package size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">
            {filterStatus === 'converted'
              ? 'Nenhum pedido realizado ainda.'
              : 'Nenhum pedido encontrado.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produto/Serviço
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Instância
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data do Pedido
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {product.service?.imageUrl && (
                          <img
                            src={product.service.imageUrl}
                            alt={product.productName}
                            className="w-10 h-10 rounded object-cover"
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {product.productName}
                          </div>
                          {product.service?.description && (
                            <div className="text-xs text-gray-500 truncate max-w-xs">
                              {product.service.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-gray-400" />
                        <span className="text-sm text-gray-900">{product.contactNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <DollarSign size={16} className="text-green-600" />
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(product.service?.price || null)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{product.instance.name}</span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Calendar size={16} className="text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {formatDate(product.convertedAt || product.lastInteraction)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          product.status === 'converted'
                            ? 'bg-green-100 text-green-800'
                            : product.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {product.status === 'converted'
                          ? 'Confirmado'
                          : product.status === 'pending'
                          ? 'Pendente'
                          : 'Abandonado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

