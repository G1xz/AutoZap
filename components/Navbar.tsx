'use client'

import { useSession, signOut } from 'next-auth/react'
import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { ChevronDown, LogOut, User as UserIcon } from 'lucide-react'
import ProfileEditModal from './ProfileEditModal'

export default function Navbar() {
  const { data: session, update: updateSession } = useSession()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fecha o dropdown quando clica fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Carrega foto de perfil quando o componente monta ou a sessão muda
  useEffect(() => {
    loadProfilePicture()
  }, [session?.user?.id])

  const loadProfilePicture = async () => {
    try {
      const response = await fetch('/api/profile')
      if (response.ok) {
        const data = await response.json()
        setProfilePictureUrl(data.profilePictureUrl)
      }
    } catch (error) {
      console.error('Erro ao carregar foto de perfil:', error)
    }
  }

  const handleSignOut = () => {
    signOut()
  }

  const handleProfileUpdate = async () => {
    await loadProfilePicture()
    // Recarrega a sessão para atualizar o nome
    await updateSession()
  }

  const userName = session?.user?.name || 'Usuário'
  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <nav className="w-full flex items-center justify-between px-4 py-3">
        {/* Logo e nome */}
        <div className="flex items-center gap-3 pl-4">
          <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
            <Image
              src="/icon.png"
              alt="AutoFlow Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <span className="text-gray-900 text-lg sm:text-xl font-semibold hidden sm:block">
            AutoFlow
          </span>
        </div>

        {/* Menu de perfil */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50/50 hover:bg-gray-100/50 transition-colors"
          >
            {/* Avatar */}
            {profilePictureUrl ? (
              <div className="relative w-8 h-8 rounded-full overflow-hidden border border-gray-200">
                <Image
                  src={profilePictureUrl}
                  alt={userName}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-autozap-primary flex items-center justify-center text-white font-semibold text-sm">
                {userInitials}
              </div>
            )}
            {/* Nome */}
            <span className="text-gray-900 text-sm font-medium hidden sm:block max-w-[150px] truncate">
              {userName}
            </span>
            <ChevronDown 
              className={`text-gray-900 w-4 h-4 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  {profilePictureUrl ? (
                    <div className="relative w-10 h-10 rounded-full overflow-hidden border border-gray-200">
                      <Image
                        src={profilePictureUrl}
                        alt={userName}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-autozap-primary flex items-center justify-center text-white font-semibold">
                      {userInitials}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {userName}
                    </p>
                    {session?.user?.email && (
                      <p className="text-xs text-gray-500 truncate">
                        {session.user.email}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(true)
                  setIsProfileOpen(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors"
              >
                <UserIcon className="w-4 h-4" />
                Editar perfil
              </button>
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          )}
        </div>

        {/* Modal de edição de perfil */}
        <ProfileEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onUpdate={handleProfileUpdate}
        />
    </nav>
  )
}

