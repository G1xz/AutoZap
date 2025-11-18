import { v2 as cloudinary } from 'cloudinary'

// Configuração lazy do Cloudinary (só configura quando necessário, em runtime)
let cloudinaryConfigured = false

function configureCloudinary() {
  if (cloudinaryConfigured) return

  const cloudinaryUrl = process.env.CLOUDINARY_URL
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (cloudinaryUrl && cloudinaryUrl.startsWith('cloudinary://')) {
    // Usa CLOUDINARY_URL (formato: cloudinary://api_key:api_secret@cloud_name)
    cloudinary.config()
    console.log('✅ Cloudinary configurado via CLOUDINARY_URL')
    cloudinaryConfigured = true
  } else if (cloudName && apiKey && apiSecret) {
    // Fallback: usa variáveis individuais
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    })
    console.log('✅ Cloudinary configurado via variáveis individuais')
    cloudinaryConfigured = true
  } else {
    // Não configura durante o build, só loga se tentar usar
    console.warn('⚠️ Cloudinary não configurado. Configure CLOUDINARY_URL ou as variáveis individuais')
  }
}

/**
 * Faz upload de um arquivo (Buffer) para o Cloudinary
 */
export async function uploadFileToCloudinary(
  fileBuffer: Buffer,
  fileName: string,
  folder: string = 'autozap',
  resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto'
): Promise<{ url: string; secure_url: string; public_id: string }> {
  // Configura Cloudinary se ainda não foi configurado (lazy initialization)
  configureCloudinary()

  // Valida configuração antes de tentar upload
  const cloudinaryUrl = process.env.CLOUDINARY_URL
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  
  const hasValidCloudinaryUrl = cloudinaryUrl && cloudinaryUrl.startsWith('cloudinary://')
  const hasIndividualVars = cloudName && apiKey && apiSecret
  
  if (!hasValidCloudinaryUrl && !hasIndividualVars) {
    throw new Error('Cloudinary não configurado. Configure CLOUDINARY_URL (formato: cloudinary://...) ou as variáveis CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET')
  }

  return new Promise((resolve, reject) => {
    // Gera nome único para o arquivo
    const timestamp = Date.now()
    // Remove caracteres especiais do nome do arquivo para evitar problemas
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^/.]+$/, '')
    const publicId = `${folder}/${timestamp}-${cleanFileName}`

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        public_id: publicId,
        // Não usa timestamp na assinatura para evitar problemas
        use_filename: false,
        unique_filename: true,
      },
      (error, result) => {
        if (error) {
          console.error('Erro ao fazer upload para Cloudinary:', error)
          // Log mais detalhado para debug
          if (error.http_code === 401) {
            console.error('❌ Erro de autenticação. Verifique se as credenciais estão corretas.')
            const currentCloudinaryUrl = process.env.CLOUDINARY_URL
            const currentCloudName = process.env.CLOUDINARY_CLOUD_NAME
            const currentApiKey = process.env.CLOUDINARY_API_KEY
            const currentApiSecret = process.env.CLOUDINARY_API_SECRET
            
            if (currentCloudinaryUrl && currentCloudinaryUrl.startsWith('cloudinary://')) {
              console.error('   Usando CLOUDINARY_URL')
            } else {
              console.error('   Cloud Name:', currentCloudName)
              console.error('   API Key:', currentApiKey)
              console.error('   API Secret length:', currentApiSecret?.length || 0)
            }
          }
          reject(error)
          return
        }

        if (!result) {
          reject(new Error('Upload retornou resultado vazio'))
          return
        }

        resolve({
          url: result.url,
          secure_url: result.secure_url,
          public_id: result.public_id,
        })
      }
    )

    uploadStream.end(fileBuffer)
  })
}

/**
 * Faz upload de uma URL para o Cloudinary (útil para baixar mídia do WhatsApp)
 */
export async function uploadUrlToCloudinary(
  url: string,
  folder: string = 'autozap',
  resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto'
): Promise<{ url: string; secure_url: string; public_id: string }> {
  // Configura Cloudinary se ainda não foi configurado (lazy initialization)
  configureCloudinary()
  
  try {
    const timestamp = Date.now()
    const result = await cloudinary.uploader.upload(url, {
      folder,
      resource_type: resourceType,
      public_id: `${folder}/${timestamp}`,
    })

    return {
      url: result.url,
      secure_url: result.secure_url,
      public_id: result.public_id,
    }
  } catch (error) {
    console.error('Erro ao fazer upload de URL para Cloudinary:', error)
    throw error
  }
}

/**
 * Deleta um arquivo do Cloudinary
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId)
  } catch (error) {
    console.error('Erro ao deletar arquivo do Cloudinary:', error)
    throw error
  }
}

/**
 * Obtém URL otimizada de uma imagem/vídeo do Cloudinary
 */
export function getCloudinaryUrl(publicId: string, options: {
  width?: number
  height?: number
  quality?: number
  format?: string
} = {}): string {
  const transformations: string[] = []

  if (options.width) transformations.push(`w_${options.width}`)
  if (options.height) transformations.push(`h_${options.height}`)
  if (options.quality) transformations.push(`q_${options.quality}`)
  if (options.format) transformations.push(`f_${options.format}`)

  const transformString = transformations.length > 0
    ? transformations.join(',') + '/'
    : ''

  return cloudinary.url(publicId, {
    secure: true,
    transformation: transformString ? [{ raw_transformation: transformString }] : undefined,
  })
}

