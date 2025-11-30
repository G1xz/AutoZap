'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { MessageSquare, Calendar, Package, Users, Workflow, BarChart, Settings, ShoppingBag } from 'lucide-react'
import WorkflowsManager from './WorkflowsManager'
import ChatManager from './ChatManager'
import ServicesManager from './ServicesManager'
import SchedulingManager from './SchedulingManager'
import ClientsManager from './ClientsManager'
import ReportsManager from './ReportsManager'
import SettingsManager from './SettingsManager'
import ProductsManager from './ProductsManager'
import StaggeredMenu, { StaggeredMenuSocialItem } from './StaggeredMenu'

export default function DashboardContent() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<'chat' | 'scheduling' | 'services' | 'clients' | 'workflows' | 'reports' | 'settings' | 'products'>('chat')

  // Mapeia o activeTab para o label do menu
  const getActiveLabel = () => {
    switch (activeTab) {
      case 'chat':
        return 'Chat'
      case 'scheduling':
        return 'Agenda'
      case 'services':
        return 'Catálogo'
      case 'clients':
        return 'Clientes'
      case 'workflows':
        return 'Fluxos'
      case 'reports':
        return 'Relatórios'
      case 'settings':
        return 'Configurações'
      case 'products':
        return 'Produtos'
      default:
        return undefined
    }
  }

  const menuItems = [
    { 
      label: 'Chat', 
      ariaLabel: 'Abrir chat de atendimento',
      onClick: () => setActiveTab('chat'),
      icon: <MessageSquare size={28} strokeWidth={2} />
    },
    { 
      label: 'Agenda', 
      ariaLabel: 'Gerenciar agenda',
      onClick: () => setActiveTab('scheduling'),
      icon: <Calendar size={28} strokeWidth={2} />
    },
    { 
      label: 'Catálogo', 
      ariaLabel: 'Gerenciar catálogo de serviços e produtos',
      onClick: () => setActiveTab('services'),
      icon: <Package size={28} strokeWidth={2} />
    },
    { 
      label: 'Produtos', 
      ariaLabel: 'Ver produtos comprados',
      onClick: () => setActiveTab('products'),
      icon: <ShoppingBag size={28} strokeWidth={2} />
    },
    { 
      label: 'Clientes', 
      ariaLabel: 'Gerenciar clientes',
      onClick: () => setActiveTab('clients'),
      icon: <Users size={28} strokeWidth={2} />
    },
    { 
      label: 'Fluxos', 
      ariaLabel: 'Gerenciar fluxos visuais',
      onClick: () => setActiveTab('workflows'),
      icon: <Workflow size={28} strokeWidth={2} />
    },
    { 
      label: 'Relatórios', 
      ariaLabel: 'Ver relatórios',
      onClick: () => setActiveTab('reports'),
      icon: <BarChart size={28} strokeWidth={2} />
    },
    { 
      label: 'Configurações', 
      ariaLabel: 'Configurações do sistema',
      onClick: () => setActiveTab('settings'),
      icon: <Settings size={28} strokeWidth={2} />
    },
  ]

  const socialItems: StaggeredMenuSocialItem[] = [
    // Adicione seus links sociais aqui se quiser
  ]

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <StaggeredMenu
        position="left"
        items={menuItems}
        socialItems={socialItems}
        displaySocials={false}
        displayItemNumbering={false}
        menuButtonColor="#1a1a1a"
        openMenuButtonColor="#000"
        changeMenuColorOnOpen={true}
        colors={['#f9fafb', '#f3f4f6', '#e5e7eb']}
        accentColor="#5227FF"
        isFixed={true}
        activeItemLabel={getActiveLabel()}
        onMenuOpen={() => console.log('Menu opened')}
        onMenuClose={() => console.log('Menu closed')}
      />

      {/* Conteúdo principal */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8 pt-20 sm:pt-24 relative z-10">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-3 sm:p-6">
            {activeTab === 'chat' && <ChatManager />}
            {activeTab === 'scheduling' && <SchedulingManager />}
            {activeTab === 'services' && <ServicesManager />}
            {activeTab === 'products' && <ProductsManager />}
            {activeTab === 'clients' && <ClientsManager />}
            {activeTab === 'workflows' && <WorkflowsManager />}
            {activeTab === 'reports' && <ReportsManager />}
            {activeTab === 'settings' && <SettingsManager />}
          </div>
        </div>
      </div>

      {/* Botão de logout fixo no canto inferior direito */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-30">
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs sm:text-sm text-gray-700 bg-white border border-gray-200 px-2 sm:px-3 py-1 rounded shadow-sm hidden sm:block">
            {session?.user?.name}
          </span>
          <button
            onClick={() => signOut()}
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors shadow-lg text-sm sm:text-base"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}



