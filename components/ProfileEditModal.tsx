'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { X, Upload, User } from 'lucide-react'
import { toast } from 'sonner'

interface ProfileEditModalProps {
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

export default function ProfileEditModal({ isOpen, onClose, onUpdate }: ProfileEditModalProps) {
  const { data: session, update: updateSession } = useSession()
  const [name, setName] = useState('')
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Carrega dados do perfil quando o modal abre
  useEffect(() => {
    if (isOpen) {
      loadProfile()
    } else {
      // Limpa preview quando fecha
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
      setPreviewUrl(null)
    }
  }, [isOpen])

  const loadProfile = async () => {
    setIsLoadingProfile(true)
    try {
      const response = await fetch('/api/profile')
      if (response.ok) {
        const data = await response.json()
        setName(data.name || '')
        setProfilePictureUrl(data.profilePictureUrl)
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error)
    } finally {
      setIsLoadingProfile(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Valida tipo
      if (!file.type.startsWith('image/')) {
        toast.error('Apenas imagens são permitidas')
        return
      }

      // Valida tamanho (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Máximo de 5MB.')
        return
      }

      // Cria preview
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append('name', name)

      // Adiciona arquivo se houver preview (novo arquivo selecionado)
      if (previewUrl && previewUrl.startsWith('blob:')) {
        const fileInput = fileInputRef.current
        if (fileInput?.files?.[0]) {
          formData.append('file', fileInput.files[0])
        }
      }

      const response = await fetch('/api/profile', {
        method: 'PUT',
        body: formData,
      })

      if (!response.ok) {
        let errorMessage = 'Erro ao atualizar perfil'
        try {
          const error = await response.json()
          errorMessage = error.error || errorMessage
        } catch (e) {
          errorMessage = `Erro ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const updatedUser = await response.json()

      // Atualiza a sessão - chama updateSession sem parâmetros para triggerar o callback jwt
      await updateSession()

      toast.success('Perfil atualizado com sucesso!')
      onUpdate()
      onClose()
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar perfil')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemovePhoto = async () => {
    if (!profilePictureUrl && !previewUrl) return

    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('name', name)
      formData.append('removePhoto', 'true')

      const response = await fetch('/api/profile', {
        method: 'PUT',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Erro ao remover foto')
      }

      const updatedUser = await response.json()
      setProfilePictureUrl(null)
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
      setPreviewUrl(null)
      toast.success('Foto removida com sucesso!')
    } catch (error) {
      toast.error('Erro ao remover foto')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  const displayUrl = previewUrl || profilePictureUrl
  const userInitials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Editar Perfil</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Foto de perfil */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {displayUrl ? (
                <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200">
                  <Image
                    src={displayUrl}
                    alt="Foto de perfil"
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-full bg-autozap-primary flex items-center justify-center text-white text-2xl font-semibold border-2 border-gray-200">
                  {userInitials || <User className="w-12 h-12" />}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors flex items-center gap-2"
                disabled={isLoading}
              >
                <Upload className="w-4 h-4" />
                {displayUrl ? 'Alterar foto' : 'Adicionar foto'}
              </button>
              {displayUrl && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="px-4 py-2 text-sm bg-red-50 hover:bg-red-100 text-red-600 rounded-md transition-colors"
                  disabled={isLoading}
                >
                  Remover
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
              placeholder="Seu nome"
              disabled={isLoading || isLoadingProfile}
            />
          </div>

          {/* Email (somente leitura) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={session?.user?.email || ''}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || isLoadingProfile}
            >
              {isLoading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

