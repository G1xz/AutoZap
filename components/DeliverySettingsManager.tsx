'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'
import { Truck } from 'lucide-react'

export default function DeliverySettingsManager() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [deliveryPricePerKm, setDeliveryPricePerKm] = useState<string>('')
  const [maxDeliveryDistanceKm, setMaxDeliveryDistanceKm] = useState<string>('')

  useEffect(() => {
    if (session?.user?.id) {
      fetchDeliverySettings()
    }
  }, [session])

  const fetchDeliverySettings = async () => {
    try {
      const response = await fetch('/api/delivery-settings')
      if (response.ok) {
        const data = await response.json()
        const address = data.businessAddress || ''
        
        // Tenta parsear o endereço se estiver em formato completo
        if (address) {
          // Formato esperado: "Rua, Número, Bairro, Cidade - Estado, CEP"
          const parts = address.split(',').map((p: string) => p.trim())
          
          if (parts.length >= 4) {
            setStreet(parts[0] || '')
            setNumber(parts[1] || '')
            setNeighborhood(parts[2] || '')
            
            // Cidade e Estado estão juntos: "Cidade - Estado"
            const cityStatePart = parts[3] || ''
            const cityStateMatch = cityStatePart.match(/^(.+?)\s*-\s*(.+)$/)
            if (cityStateMatch) {
              setCity(cityStateMatch[1].trim())
              setState(cityStateMatch[2].trim().toUpperCase())
            } else {
              // Se não tem o formato "Cidade - Estado", assume que é só a cidade
              setCity(cityStatePart)
            }
            
            // CEP pode estar no último campo
            if (parts.length > 4) {
              setZipCode(parts[4] || '')
            } else if (parts.length === 4 && parts[3].includes('CEP')) {
              // Tenta extrair CEP se estiver junto com cidade/estado
              const cepMatch = parts[3].match(/(\d{5}-?\d{3})/)
              if (cepMatch) {
                setZipCode(cepMatch[1])
              }
            }
          } else {
            // Se não conseguir parsear, tenta dividir por espaços ou deixa tudo no campo de rua
            // Mas tenta pelo menos separar CEP se houver
            const cepMatch = address.match(/(\d{5}-?\d{3})/)
            if (cepMatch) {
              setStreet(address.replace(cepMatch[0], '').trim())
              setZipCode(cepMatch[1])
            } else {
              setStreet(address)
            }
          }
        }
        
        setDeliveryPricePerKm(data.deliveryPricePerKm?.toString() || '')
        setMaxDeliveryDistanceKm(data.maxDeliveryDistanceKm?.toString() || '')
      }
    } catch (error) {
      console.error('Erro ao buscar configurações de entrega:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!session?.user?.id) return

    // Validações
    if (!street.trim() || !number.trim() || !neighborhood.trim() || !city.trim() || !state.trim()) {
      toast.error('Por favor, preencha todos os campos obrigatórios do endereço.')
      return
    }

    if (!deliveryPricePerKm.trim()) {
      toast.error('Por favor, informe o preço por quilômetro.')
      return
    }

    const price = parseFloat(deliveryPricePerKm.replace(',', '.'))
    if (isNaN(price) || price < 0) {
      toast.error('Por favor, informe um preço válido (número maior ou igual a zero).')
      return
    }

    // Validação do limite de distância (opcional)
    let maxDistance: number | null = null
    if (maxDeliveryDistanceKm.trim()) {
      maxDistance = parseFloat(maxDeliveryDistanceKm.replace(',', '.'))
      if (isNaN(maxDistance) || maxDistance <= 0) {
        toast.error('Por favor, informe um limite de distância válido (número maior que zero) ou deixe em branco para sem limite.')
        return
      }
    }

    // Monta endereço completo
    const addressParts = [
      street.trim(),
      number.trim(),
      neighborhood.trim(),
      `${city.trim()} - ${state.trim()}`,
      zipCode.trim()
    ].filter(Boolean)
    const fullAddress = addressParts.join(', ')

    setSaving(true)
    try {
      const response = await fetch('/api/delivery-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessAddress: fullAddress,
          deliveryPricePerKm: price,
          maxDeliveryDistanceKm: maxDistance,
        }),
      })

      if (response.ok) {
        toast.success('Configurações de entrega salvas com sucesso!')
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'Erro ao salvar configurações'
        console.error('Erro da API:', errorMessage)
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error)
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível salvar as configurações de entrega.'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-4">Carregando configurações...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Truck size={20} className="text-gray-700" />
        <h3 className="text-lg font-semibold text-gray-900">Configurações de Entrega</h3>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
        {/* Endereço do Estabelecimento */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Endereço do Estabelecimento *
          </label>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rua */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Rua *
              </label>
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Ex: Rua das Flores"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
              />
            </div>

            {/* Número */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Número *
              </label>
              <input
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Ex: 123"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
              />
            </div>

            {/* Bairro */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Bairro *
              </label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Ex: Centro"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
              />
            </div>

            {/* Cidade */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Cidade *
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex: São Paulo"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
              />
            </div>

            {/* Estado */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Estado (UF) *
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                placeholder="Ex: SP"
                maxLength={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent uppercase"
              />
            </div>

            {/* CEP */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                CEP (opcional)
              </label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => {
                  // Formata CEP: 12345-678
                  const value = e.target.value.replace(/\D/g, '')
                  const formatted = value.length > 5 
                    ? `${value.slice(0, 5)}-${value.slice(5, 8)}`
                    : value
                  setZipCode(formatted)
                }}
                placeholder="Ex: 01234-567"
                maxLength={9}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
              />
            </div>
          </div>
          
          <p className="text-xs text-gray-500 mt-2">
            Preencha todos os campos obrigatórios para cálculo preciso de frete.
          </p>
        </div>

        {/* Preço por Quilômetro */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Preço por Quilômetro (R$) *
          </label>
          <input
            type="text"
            value={deliveryPricePerKm}
            onChange={(e) => {
              // Permite apenas números, vírgula e ponto
              const value = e.target.value.replace(/[^\d,.]/g, '')
              // Garante apenas uma vírgula ou ponto
              const parts = value.split(/[,.]/)
              if (parts.length <= 2) {
                setDeliveryPricePerKm(value)
              }
            }}
            placeholder="Ex: 2,50 ou 2.50"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            Valor cobrado por quilômetro de distância entre o estabelecimento e o endereço de entrega.
          </p>
        </div>

        {/* Limite de Distância */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Limite de Distância para Entrega (km)
          </label>
          <input
            type="text"
            value={maxDeliveryDistanceKm}
            onChange={(e) => {
              // Permite apenas números, vírgula e ponto
              const value = e.target.value.replace(/[^\d,.]/g, '')
              // Garante apenas uma vírgula ou ponto
              const parts = value.split(/[,.]/)
              if (parts.length <= 2) {
                setMaxDeliveryDistanceKm(value)
              }
            }}
            placeholder="Ex: 10 ou deixe em branco para sem limite"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            Distância máxima em quilômetros para realizar entregas. Se o endereço estiver além deste limite, a entrega não será permitida. Deixe em branco para não ter limite.
          </p>
        </div>

        {/* Botão Salvar */}
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </div>
    </div>
  )
}

