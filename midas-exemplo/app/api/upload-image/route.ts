import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import sharp from 'sharp';

// Função para compressão adicional no servidor
async function compressServerSide(inputBuffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(inputBuffer)
      .resize({ width: 1024 })
      .jpeg({ quality: 70 })
      .toBuffer();
  } catch (error) {
    console.error('Erro na compressão do servidor:', error);
    // Retornar buffer original se a compressão falhar
    return inputBuffer;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('📤 Image upload request received');
    
    // Verificar autenticação
    const { userId } = await auth();
    console.log('🔐 User ID:', userId);
    
    if (!userId) {
      console.log('❌ Unauthorized - no user ID');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const image = formData.get('image') as File;
    
    console.log('📁 FormData received, image:', image ? `${image.name} (${image.size} bytes)` : 'null');

    if (!image) {
      console.log('❌ No image provided');
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Validar tipo de arquivo
    if (!image.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Validar tamanho (20MB max - será comprimido)
    if (image.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image too large. Maximum size is 20MB' },
        { status: 400 }
      );
    }

    // Criar diretório se não existir
    const uploadDir = join(process.cwd(), 'public', 'uploads', userId);
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Gerar nome único para o arquivo (sempre .jpg após compressão)
    const timestamp = Date.now();
    const fileName = `${timestamp}.jpg`;
    const filePath = join(uploadDir, fileName);

    // Converter para buffer
    const bytes = await image.arrayBuffer();
    const originalBuffer = Buffer.from(bytes);
    
    console.log('Tamanho original:', (originalBuffer.length / 1024).toFixed(2), 'KB');

    // Aplicar compressão adicional no servidor
    const compressedBuffer = await compressServerSide(originalBuffer);
    
    console.log('Tamanho após compressão:', (compressedBuffer.length / 1024).toFixed(2), 'KB');

    // Salvar arquivo comprimido
    await writeFile(filePath, compressedBuffer);

    // Retornar URL da imagem
    const imageUrl = `/uploads/${userId}/${fileName}`;
    
    console.log('✅ Image uploaded successfully:', imageUrl);
    console.log('📊 Final file size:', (compressedBuffer.length / 1024).toFixed(2), 'KB');

    return NextResponse.json({ imageUrl });

  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
