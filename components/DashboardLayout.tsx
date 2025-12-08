'use client'

import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { MessageSquare, Calendar, Package, Users, Workflow, BarChart, Settings, ShoppingBag, Bug, TestTube } from 'lucide-react'
import StaggeredMenu, { StaggeredMenuSocialItem } from './StaggeredMenu'
import SlotCompatibilityBanner from './SlotCompatibilityBanner'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()

  // Verifica se está em uma página de editor (fluxos ou catálogos)
  const isEditorPage = pathname?.includes('/workflows/') || pathname?.includes('/catalogs/')

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
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8 pt-20 sm:pt-24 relative z-10">
          <SlotCompatibilityBanner />
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-3 sm:p-6">
              {children}
            </div>
          </div>
        </div>
      )}

      {/* Botão de logout fixo no canto inferior direito */}
      {!isEditorPage && (
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
      )}
    </div>
  )
}

