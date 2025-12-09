'use client'

import { usePathname } from 'next/navigation'
import { MessageSquare, Calendar, Package, Users, Workflow, BarChart, Settings, ShoppingBag, Bug, TestTube, CreditCard } from 'lucide-react'
import StaggeredMenu, { StaggeredMenuSocialItem } from './StaggeredMenu'
import SlotCompatibilityBanner from './SlotCompatibilityBanner'
import Navbar from './Navbar'
import PointsIndicator from './PointsIndicator'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Verifica se está em uma página de editor (fluxos ou catálogos)
  const isEditorPage = pathname?.includes('/workflows/') || pathname?.includes('/catalogs/')
  
  // Verifica se está na página de pedidos (para aplicar layout com scroll interno)
  const isOrdersPage = pathname?.includes('/pedidos')

  // Mapeia o pathname para o label do menu
  const getActiveLabel = () => {
    if (pathname?.startsWith('/dashboard/chat')) return 'Chat'
    if (pathname?.startsWith('/dashboard/agenda')) return 'Agenda'
    if (pathname?.startsWith('/dashboard/catalogo')) return 'Catálogo'
    if (pathname?.startsWith('/dashboard/pedidos')) return 'Pedidos'
    if (pathname?.startsWith('/dashboard/clientes')) return 'Clientes'
    if (pathname?.startsWith('/dashboard/fluxos')) return 'Fluxos'
    if (pathname?.startsWith('/dashboard/relatorios')) return 'Relatórios'
    if (pathname?.startsWith('/dashboard/configuracoes')) return 'Configurações'
    if (pathname?.startsWith('/dashboard/plans')) return 'Planos'
    if (pathname?.startsWith('/dashboard/debug')) return 'Debug'
    if (pathname?.startsWith('/dashboard/test-chat')) return 'Test Chat'
    return undefined
  }

  const menuItems = [
    { 
      label: 'Chat', 
      ariaLabel: 'Abrir chat de atendimento',
      link: '/dashboard/chat',
      icon: <MessageSquare size={28} strokeWidth={2} />
    },
    { 
      label: 'Agenda', 
      ariaLabel: 'Gerenciar agenda',
      link: '/dashboard/agenda',
      icon: <Calendar size={28} strokeWidth={2} />
    },
    { 
      label: 'Catálogo', 
      ariaLabel: 'Gerenciar catálogo de serviços e produtos',
      link: '/dashboard/catalogo',
      icon: <Package size={28} strokeWidth={2} />
    },
    { 
      label: 'Pedidos', 
      ariaLabel: 'Ver pedidos realizados',
      link: '/dashboard/pedidos',
      icon: <ShoppingBag size={28} strokeWidth={2} />
    },
    { 
      label: 'Clientes', 
      ariaLabel: 'Gerenciar clientes',
      link: '/dashboard/clientes',
      icon: <Users size={28} strokeWidth={2} />
    },
    { 
      label: 'Fluxos', 
      ariaLabel: 'Gerenciar fluxos visuais',
      link: '/dashboard/fluxos',
      icon: <Workflow size={28} strokeWidth={2} />
    },
    { 
      label: 'Relatórios', 
      ariaLabel: 'Ver relatórios',
      link: '/dashboard/relatorios',
      icon: <BarChart size={28} strokeWidth={2} />
    },
    { 
      label: 'Planos', 
      ariaLabel: 'Ver e assinar planos',
      link: '/dashboard/plans',
      icon: <CreditCard size={28} strokeWidth={2} />
    },
    { 
      label: 'Configurações', 
      ariaLabel: 'Configurações do sistema',
      link: '/dashboard/configuracoes',
      icon: <Settings size={28} strokeWidth={2} />
    },
    { 
      label: 'Debug', 
      ariaLabel: 'Logs e debug do sistema',
      link: '/dashboard/debug',
      icon: <Bug size={28} strokeWidth={2} />
    },
    { 
      label: 'Test Chat', 
      ariaLabel: 'Chat de teste da IA',
      link: '/dashboard/test-chat',
      icon: <TestTube size={28} strokeWidth={2} />
    },
  ]

  const socialItems: StaggeredMenuSocialItem[] = [
    // Adicione seus links sociais aqui se quiser
  ]

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Navbar no topo */}
      {!isEditorPage && (
        <>
          <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-3 pb-2">
            <div className="w-full max-w-7xl px-2 sm:px-4 lg:px-8">
              <div className="bg-white/70 backdrop-blur-md rounded-full border-2 border-gray-300/50 shadow-sm">
                <Navbar />
              </div>
            </div>
          </div>
          
          {/* Indicador de pontos à direita (fora da navbar, centralizado no espaço restante) */}
          <div className="fixed z-50 flex items-center" style={{ 
            top: '0.75rem', // Mesmo top da navbar (pt-3 = 0.75rem)
            left: 'calc((100vw - 1280px) / 2 + 1280px + 1rem)',
            right: '1rem',
            height: '3.5rem' // Mesma altura da navbar (56px = 3.5rem)
          }}>
            <div className="w-full h-full flex items-center justify-center">
              <div className="hidden md:block">
                <div className="bg-white/70 backdrop-blur-md rounded-full border-2 border-gray-300/50 shadow-sm px-4 py-3 h-[3.5rem] flex items-center">
                  <PointsIndicator />
                </div>
              </div>
              
              {/* Indicador de pontos mobile */}
              <div className="md:hidden">
                <div className="bg-white/70 backdrop-blur-md rounded-full border-2 border-gray-300/50 shadow-sm px-3 py-2.5 h-[3rem] flex items-center">
                  <PointsIndicator compact />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!isEditorPage && (
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
      )}

      {/* Conteúdo principal */}
      {isEditorPage ? (
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 pt-0 z-10">
          {children}
        </div>
      ) : (
        <div className={`max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8 pt-28 sm:pt-32 relative z-10 ${isOrdersPage ? 'h-[calc(100vh-7rem)]' : ''}`}>
          <SlotCompatibilityBanner />
          <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${isOrdersPage ? 'h-full flex flex-col' : ''}`}>
            <div className={`p-3 sm:p-6 ${isOrdersPage ? 'flex-1 flex flex-col min-h-0' : ''}`}>
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

