import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { auth } from '@clerk/nextjs/server';
import { logTokenUsage } from '@/app/_lib/token-tracking';
import { canUserUseMidas, canUserSendAudio, getUserPlan } from '@/app/_lib/plan-limits';
import { prisma } from '@/app/_lib/prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000, // 60 seconds timeout
  maxRetries: 0, // Desabilitar retries do SDK para controlar manualmente
});

// Função para retry com backoff exponencial
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Se não é mais tentativas ou não é erro de conexão, falha imediatamente
      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }
      
      // Delay exponencial com jitter: 1s, 2s, 4s...
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(`Tentativa ${attempt + 1} falhou, tentando novamente em ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Verifica se o erro é recuperável (conexão, timeout, etc.)
function isRetryableError(error: unknown): boolean {
  if (!error) return false;
  
  const retryableErrors = [
    'ECONNRESET',
    'ECONNREFUSED', 
    'ETIMEDOUT',
    'ENOTFOUND',
    'APIConnectionError',
    'APITimeoutError',
    'FetchError',
    'NetworkError',
    'socket hang up',
    'read ECONNRESET'
  ];
  
  const errorString = JSON.stringify(error).toLowerCase();
  const errorMessage = (error as any).message?.toLowerCase() || '';
  const errorCode = (error as any).code?.toLowerCase() || '';
  
  return retryableErrors.some(errorType => 
    errorCode === errorType || 
    errorType === errorType ||
    errorMessage.includes(errorType) ||
    errorString.includes(errorType)
  );
}

export async function POST(request: NextRequest) {
  try {
    // Verificar se a API key está configurada
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY não está configurada');
      return NextResponse.json(
        { error: 'Serviço de transcrição não configurado.' },
        { status: 500 }
      );
    }

    // Verificar status da conta OpenAI (billing, créditos, etc.)
    try {
      console.log('Verificando status da conta OpenAI...');
      const accountResponse = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!accountResponse.ok) {
        const errorText = await accountResponse.text();
        console.error('Erro na verificação da conta:', accountResponse.status, errorText);
        
        if (accountResponse.status === 401) {
          return NextResponse.json(
            { error: 'API key inválida ou expirada.' },
            { status: 401 }
          );
        }
        
        if (accountResponse.status === 429) {
          return NextResponse.json(
            { error: 'Limite de requisições excedido. Verifique sua assinatura.' },
            { status: 429 }
          );
        }
        
        if (accountResponse.status === 402) {
          return NextResponse.json(
            { error: 'Problema de pagamento. Adicione um método de pagamento na sua conta OpenAI.' },
            { status: 402 }
          );
        }
      }
      
      console.log('Status da conta OpenAI: OK');
    } catch (accountError) {
      console.error('Erro ao verificar conta OpenAI:', accountError);
      // Continuar mesmo se a verificação falhar
    }

    // Verificar autenticação
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verificar se o usuário pode usar o Midas
    const canUseMidas = await canUserUseMidas();
    if (!canUseMidas) {
      return NextResponse.json(
        { error: 'Você precisa de um plano ativo para usar o Midas AI. Assine um plano para continuar.' },
        { status: 403 }
      );
    }

    // Verificar limites específicos por plano
    const userPlan = await getUserPlan();
    
    // Verificar se pode enviar áudio (plano Start)
    if (userPlan === "start") {
      const canSendAudio = await canUserSendAudio();
      if (!canSendAudio) {
        return NextResponse.json(
          { 
            error: "LIMIT_REACHED",
            limitType: "audios",
            message: "Você atingiu o limite de 2 áudios por mês do plano Start. Faça upgrade para continuar."
          },
          { status: 403 }
        );
      }
    }

    // Obter o arquivo de áudio do FormData
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      );
    }

    // Validar tipo de arquivo
    const allowedTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/webm', 'audio/ogg'];
    if (!allowedTypes.includes(audioFile.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não suportado. Use WAV, MP3, MP4, M4A, WebM ou OGG.' },
        { status: 400 }
      );
    }

    // Validar tamanho do arquivo (máximo 25MB para Whisper)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Tamanho máximo é 25MB.' },
        { status: 400 }
      );
    }

    console.log(`Processando arquivo de áudio: ${audioFile.name}, ${audioFile.size} bytes, tipo: ${audioFile.type}`);

    // Converter o arquivo para o formato esperado pela API do Whisper
    const audioBuffer = await audioFile.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: audioFile.type });

    // Criar um arquivo temporário para a API do Whisper
    const tempFile = new File([audioBlob], 'audio.wav', { type: 'audio/wav' });

    // Função para tentar transcrição com método direto (fallback)
    const tryDirectTranscription = async () => {
      console.log('Tentando método direto de transcrição...');
      
      const formData = new FormData();
      formData.append('file', tempFile);
      formData.append('model', 'whisper-1');
      formData.append('language', 'pt');
      formData.append('response_format', 'json');
      formData.append('temperature', '0.0');
      formData.append('prompt', 'Transcrição de áudio em português brasileiro. Inclua pontuação e formatação adequada.');
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData,
        signal: AbortSignal.timeout(60000), // 60s timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Resultado bruto do método direto:', JSON.stringify(result, null, 2));
      console.log('Método direto funcionou!');
      return result.text || result;
    };

    // Tentar primeiro com SDK OpenAI (com retry)
    try {
      console.log('Tentando transcrição com SDK OpenAI...');
      const transcription = await retryWithBackoff(async () => {
        console.log('Enviando requisição para OpenAI Whisper...');
        console.log(`Arquivo: ${tempFile.name}, Tamanho: ${tempFile.size} bytes, Tipo: ${tempFile.type}`);
        
        const result = await openai.audio.transcriptions.create({
          file: tempFile,
          model: 'whisper-1',
          language: 'pt', // Português brasileiro
          response_format: 'json', // Mudar para JSON para ter mais controle
          temperature: 0.0, // Mais determinístico
          prompt: 'Transcrição de áudio em português brasileiro. Inclua pontuação e formatação adequada.', // Prompt para melhorar qualidade
        });
        
        console.log('Resultado bruto do Whisper:', JSON.stringify(result, null, 2));
        return result;
      }, 2, 1000); // Reduzir tentativas para SDK

      console.log('Transcrição com SDK concluída com sucesso');
      console.log('Texto transcrito:', `"${transcription.text}"`);
      console.log('Tamanho do texto:', transcription.text?.length || 0);
      
      // Verificar se o texto está vazio ou muito curto
      if (!transcription.text || transcription.text.trim().length < 2) {
        console.warn('Texto transcrito está vazio ou muito curto!');
        return NextResponse.json({
          error: 'Não foi possível transcrever o áudio. Tente falar mais claramente ou verifique se há áudio no arquivo.',
        }, { status: 400 });
      }
      
      // Log token usage for audio transcription only
      // O chat será registrado separadamente com custos reais
      const { userId } = await auth();
      if (userId) {
        // Estimativa: Whisper custa $0.006 por minuto
        const estimatedDuration = Math.max(1, transcription.text.length / 1000); // minutos
        const whisperCost = estimatedDuration * 0.006;
        
        console.log('🎤 Whisper only cost:', {
          transcriptionLength: transcription.text.length,
          estimatedDuration: estimatedDuration,
          whisperCost: whisperCost,
          whisperTokens: Math.round(transcription.text.length / 4)
        });
        
        // Calcular custos do Whisper
        const whisperTokens = Math.round(transcription.text.length / 4);
        
        console.log('🎤 Whisper costs calculated:', {
          whisperCost,
          whisperTokens,
          transcriptionLength: transcription.text.length
        });
        
        // Enviar dados do Whisper para o chat consolidar
        return NextResponse.json({
          text: transcription.text,
          whisperCost,
          whisperTokens
        });
      }

      return NextResponse.json({
        text: transcription.text,
      });

    } catch (sdkError) {
      console.error('SDK OpenAI falhou:', sdkError);
      
      // Tentar método direto como fallback
      try {
        const directResult = await tryDirectTranscription();
        console.log('Texto do método direto:', `"${directResult}"`);
        console.log('Tamanho do texto direto:', directResult?.length || 0);
        
        // Verificar se o texto está vazio ou muito curto
        if (!directResult || directResult.trim().length < 2) {
          console.warn('Texto do método direto está vazio ou muito curto!');
          return NextResponse.json({
            error: 'Não foi possível transcrever o áudio. Tente falar mais claramente ou verifique se há áudio no arquivo.',
          }, { status: 400 });
        }
        
        return NextResponse.json({
          text: directResult,
        });
      } catch (directError) {
        console.error('Método direto também falhou:', directError);
        
        // Tentar método direto com retry
        try {
          const directResultWithRetry = await retryWithBackoff(async () => {
            return await tryDirectTranscription();
          }, 2, 2000);
          
          console.log('Texto do método direto com retry:', `"${directResultWithRetry}"`);
          console.log('Tamanho do texto com retry:', directResultWithRetry?.length || 0);
          
          // Verificar se o texto está vazio ou muito curto
          if (!directResultWithRetry || directResultWithRetry.trim().length < 2) {
            console.warn('Texto do método direto com retry está vazio ou muito curto!');
            return NextResponse.json({
              error: 'Não foi possível transcrever o áudio. Tente falar mais claramente ou verifique se há áudio no arquivo.',
            }, { status: 400 });
          }
          
          return NextResponse.json({
            text: directResultWithRetry,
          });
        } catch (finalError) {
          console.error('Todos os métodos falharam:', finalError);
          throw finalError; // Re-throw para tratamento de erro abaixo
        }
      }
    }

  } catch (error) {
    console.error('Error processing audio:', error);
    
    // Tratamento específico de erros
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      
      if (errorMessage.includes('econnreset') || 
          errorMessage.includes('connection error') ||
          errorMessage.includes('fetch error') ||
          errorMessage.includes('network error')) {
        return NextResponse.json(
          { error: 'Erro de conexão com o serviço de transcrição. Verifique sua conexão e tente novamente.' },
          { status: 503 }
        );
      }
      
      if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        return NextResponse.json(
          { error: 'Timeout ao processar o áudio. Tente com um arquivo menor ou mais curto.' },
          { status: 408 }
        );
      }
      
      if (errorMessage.includes('api key') || errorMessage.includes('unauthorized')) {
        return NextResponse.json(
          { error: 'API key inválida ou expirada.' },
          { status: 401 }
        );
      }

      if (errorMessage.includes('payment') || errorMessage.includes('billing') || errorMessage.includes('credit')) {
        return NextResponse.json(
          { error: 'Problema de pagamento. Adicione um método de pagamento na sua conta OpenAI.' },
          { status: 402 }
        );
      }

      if (errorMessage.includes('quota') || errorMessage.includes('limit') || errorMessage.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Limite de uso excedido. Verifique sua assinatura OpenAI.' },
          { status: 429 }
        );
      }

      if (errorMessage.includes('file too large') || errorMessage.includes('size')) {
        return NextResponse.json(
          { error: 'Arquivo muito grande. Tamanho máximo é 25MB.' },
          { status: 413 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Falha ao processar áudio. Tente novamente em alguns instantes.' },
      { status: 500 }
    );
  }
}
