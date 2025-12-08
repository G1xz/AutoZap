'use client'

import WhatsAppInstanceManager from './WhatsAppInstanceManager'
import PixKeysManager from './PixKeysManager'
import WorkingHoursManager from './WorkingHoursManager'
import DeliverySettingsManager from './DeliverySettingsManager'
import MessageCleanupManager from './MessageCleanupManager'
import SlotConfigManager from './SlotConfigManager'

export default function SettingsManager() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Configurações</h2>
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Números WhatsApp</h3>
            <WhatsAppInstanceManager />
          </div>
          <div className="border-t border-gray-200 pt-6">
            <PixKeysManager />
          </div>
          <div className="border-t border-gray-200 pt-6">
            <WorkingHoursManager />
          </div>
          <div className="border-t border-gray-200 pt-6">
            <SlotConfigManager />
          </div>
          <div className="border-t border-gray-200 pt-6">
            <DeliverySettingsManager />
          </div>
          <div className="border-t border-gray-200 pt-6">
            <MessageCleanupManager />
          </div>
        </div>
      </div>
    </div>
  )
}

