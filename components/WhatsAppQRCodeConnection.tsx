'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

interface WhatsAppQRCodeConnectionProps {
  instanceId: string
  onClose: () => void
  onSuccess: () => void
}

export default function WhatsAppQRCodeConnection({
  instanceId,
  onClose,
  onSuccess,
}: WhatsAppQRCodeConnectionProps) {
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [instructions, setInstructions] = useState<string[]>([])

  useEffect(() => {
    // Gera o QR Code ao abrir o modal
    generateQRCode()

    // Verifica conexão a cada 2 segundos
    const checkInterval = setInterval(() => {
      checkConnection()
    }, 2000)

    return () => clearInterval(checkInterval)
  }, [instanceId])

  const generateQRCode = async () => {
    try {
      setLoading(true)
      setError('')
      
      const response = await fetch(`/api/whatsapp/qrcode?instanceId=${instanceId}`)
      const data = await response.json()

      if (response.ok && data.success) {
        setQrCode(data.qrCode)
        setInstructions(data.instructions || [])
      } else {
        setError(data.error || 'Erro ao gerar QR Code')
      }
    } catch (err) {
      setError('Erro ao gerar QR Code')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/whatsapp/qrcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId }),
      })

      const data = await response.json()

      if (data.connected) {
        setConnected(true)
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 1500)
      }
    } catch (err) {
      console.error('Erro ao verificar conexão:', err)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Conectar via QR Code</h2>
        <p className="text-sm text-gray-600 mb-4">
          Use o método de coexistência para conectar o número do cliente
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {connected && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
            ✅ Conectado com sucesso!
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-autozap-primary mb-4"></div>
            <p className="text-gray-600">Gerando QR Code...</p>
          </div>
        ) : qrCode ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center">
              <div className="bg-white p-4 rounded-lg border-2 border-gray-200 mb-4">
                <img 
                  src={qrCode} 
                  alt="QR Code para conexão WhatsApp" 
                  className="w-64 h-64"
                />
              </div>
              <p className="text-sm text-gray-600 text-center mb-4">
                Escaneie este QR Code com o WhatsApp Business
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">📱 Instruções:</h3>
              <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                {instructions.map((instruction, index) => (
                  <li key={index}>{instruction}</li>
                ))}
                {instructions.length === 0 && (
                  <>
                    <li>Abra o WhatsApp Business no seu celular</li>
                    <li>Vá em <strong>Configurações</strong> → <strong>Dispositivos Conectados</strong></li>
                    <li>Toque em <strong>"Conectar Dispositivo"</strong></li>
                    <li>Escaneie o QR Code acima</li>
                    <li>Aguarde a confirmação de conexão</li>
                  </>
                )}
              </ol>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-800">
                ⚠️ <strong>Importante:</strong> O cliente precisa ter o WhatsApp Business atualizado (versão 2.24.17+) 
                e o número deve estar vinculado a uma Página do Facebook.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={generateQRCode}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                🔄 Gerar Novo QR Code
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

