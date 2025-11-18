import { v2 as cloudinary } from 'cloudinary'

// Configuração do Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
})

/**
 * Faz upload de um arquivo (Buffer) para o Cloudinary
 */
export async function uploadFileToCloudinary(
  fileBuffer: Buffer,
  fileName: string,
  folder: string = 'autozap',
  resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto'
): Promise<{ url: string; secure_url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    // Gera nome único para o arquivo
    const timestamp = Date.now()
    const publicId = `${folder}/${timestamp}-${fileName.replace(/\.[^/.]+$/, '')}`

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        public_id: publicId,
      },
      (error, result) => {
        if (error) {
          console.error('Erro ao fazer upload para Cloudinary:', error)
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

