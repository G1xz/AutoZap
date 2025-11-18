// Import dinâmico do Cloudinary para evitar execução durante o build
let cloudinaryInstance: any = null
let cloudinaryConfigured = false

async function getCloudinary() {
  if (cloudinaryInstance) return cloudinaryInstance

  // Import dinâmico só em runtime
  const { v2: cloudinary } = await import('cloudinary')
  cloudinaryInstance = cloudinary
  return cloudinary
}

// Configuração lazy do Cloudinary (só configura quando necessário, em runtime)
async function configureCloudinary() {
  if (cloudinaryConfigured) return

  const cloudinary = await getCloudinary()
  const cloudinaryUrl = process.env.CLOUDINARY_URL
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  // Valida se CLOUDINARY_URL está no formato correto
  const hasValidCloudinaryUrl = cloudinaryUrl && 
    typeof cloudinaryUrl === 'string' && 
    cloudinaryUrl.trim().startsWith('cloudinary://')

  if (hasValidCloudinaryUrl) {
    try {
      // Usa CLOUDINARY_URL (formato: cloudinary://api_key:api_secret@cloud_name)
      cloudinary.config()
      console.log('✅ Cloudinary configurado via CLOUDINARY_URL')
      cloudinaryConfigured = true
      return
    } catch (error) {
      console.warn('⚠️ Erro ao configurar via CLOUDINARY_URL, tentando variáveis individuais:', error)
      // Continua para tentar variáveis individuais
    }
  }

  // Fallback: usa variáveis individuais (mais confiável)
  if (cloudName && apiKey && apiSecret) {
    try {
      // Log para debug (não mostra o secret completo por segurança)
      console.log('🔧 Configurando Cloudinary:', {
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret_length: apiSecret.length,
        api_secret_first_chars: apiSecret.substring(0, 10),
        api_secret_last_chars: apiSecret.substring(apiSecret.length - 5),
      })
      
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      })
      console.log('✅ Cloudinary configurado via variáveis individuais')
      cloudinaryConfigured = true
    } catch (error) {
      console.error('❌ Erro ao configurar Cloudinary:', error)
      throw new Error('Falha ao configurar Cloudinary. Verifique as credenciais.')
    }
  } else {
    // Não configura durante o build, só loga se tentar usar
    const missing = []
    if (!cloudName) missing.push('CLOUDINARY_CLOUD_NAME')
    if (!apiKey) missing.push('CLOUDINARY_API_KEY')
    if (!apiSecret) missing.push('CLOUDINARY_API_SECRET')
    
    throw new Error(`Cloudinary não configurado. Configure CLOUDINARY_URL (formato: cloudinary://...) ou as variáveis: ${missing.join(', ')}`)
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
  await configureCloudinary()

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

  const cloudinary = await getCloudinary()

  return new Promise((resolve, reject) => {
    // Gera nome único para o arquivo
    const timestamp = Date.now()
    // Remove caracteres especiais do nome do arquivo para evitar problemas
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^/.]+$/, '')
    
    // IMPORTANTE: Não inclui folder no public_id se já especificamos folder separadamente
    // Isso evita duplicação na assinatura
    const publicId = `${timestamp}-${cleanFileName}`

    // Configuração mínima para evitar problemas de assinatura
    const uploadOptions: any = {
      resource_type: resourceType,
      folder: folder, // Folder separado
      public_id: publicId, // Public ID sem folder (o Cloudinary combina automaticamente)
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error: any, result: any) => {
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
  await configureCloudinary()
  
  const cloudinary = await getCloudinary()
  
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
  await configureCloudinary()
  const cloudinary = await getCloudinary()
  
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
export async function getCloudinaryUrl(publicId: string, options: {
  width?: number
  height?: number
  quality?: number
  format?: string
} = {}): Promise<string> {
  await configureCloudinary()
  const cloudinary = await getCloudinary()
  
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

