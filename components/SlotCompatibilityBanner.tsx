'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { AlertTriangle, X } from 'lucide-react'

interface IncompatibleService {
  name: string
  duration: number
  location: 'service' | 'catalog'
  catalogName?: string
}

export default function SlotCompatibilityBanner() {
  const { data: session } = useSession()
  const [incompatibleServices, setIncompatibleServices] = useState<IncompatibleService[]>([])
  const [slotSize, setSlotSize] = useState(15)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (session?.user?.id) {
      checkCompatibility()
    }
  }, [session])

  const checkCompatibility = async () => {
    try {
      // Busca configuração de slot
      const slotResponse = await fetch('/api/slot-config')
      if (slotResponse.ok) {
        const slotData = await slotResponse.json()
        const currentSlotSize = slotData.slotConfig?.slotSizeMinutes || 15
        setSlotSize(currentSlotSize)

        // Busca serviços incompatíveis
        const response = await fetch('/api/services/slot-compatibility')
        if (response.ok) {
          const data = await response.json()
          setIncompatibleServices(data.incompatibleServices || [])
        }
      }
    } catch (error) {
      console.error('Erro ao verificar compatibilidade:', error)
    }
  }

  if (dismissed || incompatibleServices.length === 0) {
    return null
  }

  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-red-500" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            ⚠️ Incompatibilidade detectada com a configuração de slots
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p className="mb-2">
              Você configurou o slot para <strong>{slotSize} minutos</strong>, mas existem serviços com durações incompatíveis:
            </p>
            <ul className="list-disc list-inside space-y-1">
              {incompatibleServices.slice(0, 5).map((service, index) => (
                <li key={index}>
                  <strong>{service.name}</strong> - {service.duration} minutos
                  {service.location === 'catalog' && service.catalogName && (
                    <span className="text-red-600"> (Catálogo: {service.catalogName})</span>
                  )}
                </li>
              ))}
              {incompatibleServices.length > 5 && (
                <li className="text-red-600 font-semibold">
                  ... e mais {incompatibleServices.length - 5} serviço(s)
                </li>
              )}
            </ul>
            <p className="mt-2 font-semibold">
              Por favor, ajuste as durações dos serviços para serem múltiplos de {slotSize} minutos ({slotSize}, {slotSize * 2}, {slotSize * 3}, etc.)
            </p>
          </div>
        </div>
        <div className="ml-4 flex-shrink-0">
          <button
            onClick={() => setDismissed(true)}
            className="inline-flex text-red-500 hover:text-red-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

