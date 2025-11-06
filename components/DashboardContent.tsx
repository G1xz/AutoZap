'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import WhatsAppInstanceManager from './WhatsAppInstanceManager'
import AutomationRulesManager from './AutomationRulesManager'
import WorkflowsManager from './WorkflowsManager'

export default function DashboardContent() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<'instances' | 'rules' | 'workflows'>('instances')

  return (
    <div className="min-h-screen bg-autozap-gray-dark">
      <nav className="bg-autozap-gray-dark shadow-sm border-b border-autozap-gray-medium">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-autozap-primary">
              WhatsApp Automation
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-autozap-white">{session?.user?.name}</span>
              <button
                onClick={() => signOut()}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-autozap-gray-dark rounded-lg shadow border border-autozap-gray-medium">
          <div className="border-b border-autozap-gray-medium">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('instances')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'instances'
                    ? 'border-autozap-primary text-autozap-primary'
                    : 'border-transparent text-autozap-gray-medium hover:text-autozap-white hover:border-autozap-gray-medium'
                }`}
              >
                Instâncias WhatsApp
              </button>
              <button
                onClick={() => setActiveTab('rules')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'rules'
                    ? 'border-autozap-primary text-autozap-primary'
                    : 'border-transparent text-autozap-gray-medium hover:text-autozap-white hover:border-autozap-gray-medium'
                }`}
              >
                Regras de Automação
              </button>
              <button
                onClick={() => setActiveTab('workflows')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'workflows'
                    ? 'border-autozap-primary text-autozap-primary'
                    : 'border-transparent text-autozap-gray-medium hover:text-autozap-white hover:border-autozap-gray-medium'
                }`}
              >
                Fluxos Visuais
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'instances' && <WhatsAppInstanceManager />}
            {activeTab === 'rules' && <AutomationRulesManager />}
            {activeTab === 'workflows' && <WorkflowsManager />}
          </div>
        </div>
      </div>
    </div>
  )
}



