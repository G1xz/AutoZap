'use client'

import WhatsAppInstanceManager from './WhatsAppInstanceManager'

export default function SettingsManager() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Configurações</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Números WhatsApp</h3>
            <WhatsAppInstanceManager />
          </div>
        </div>
      </div>
    </div>
  )
}

