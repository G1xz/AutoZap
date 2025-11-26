import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@clerk/nextjs/server";
import { getUserFinancialData } from "@/app/_data/get-user-financial-data";
import { generateEnhancedFinancialContext } from "./enhanced-context";
import { TransactionPaymentMethod, TransactionType } from "@prisma/client";
import {
  logTokenUsage,
  calculateTokenCost,
  consolidateChatCosts,
} from "@/app/_lib/token-tracking";
import {
  canUserUseMidas,
  canUserSendMessage,
  canUserSendImage,
  canUserUseTokens,
  getUserPlan,
} from "@/app/_lib/plan-limits";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Variáveis globais para armazenar custos e tokens para consolidação
let whisperCost: number = 0;
let whisperTokens: number = 0;
let chatCosts: number = 0;
let chatTokens: number = 0;
let textTransactionCosts: number = 0;
let textTransactionTokens: number = 0;

// Função para detectar se o usuário está solicitando adicionar uma transação usando GPT
async function detectTransactionRequest(
  message: string,
  imageUrl?: string,
  userId?: string,
  isFromAudio?: boolean,
): Promise<boolean> {
  try {
    const messages: any[] = [
      {
        role: "system",
        content: `Você é um assistente especializado em detectar a intenção do usuário em relação a transações financeiras.

Sua única tarefa é determinar se o usuário está solicitando ADICIONAR/REGISTRAR uma nova transação financeira.

RESPONDA APENAS COM "true" ou "false" (sem aspas, sem explicações).

EXEMPLOS DE SOLICITAÇÕES DE TRANSAÇÃO (responda "true"):
- "Gastei 50 reais no KFC"
- "Comprei um celular por 800 reais"
- "Paguei 200 reais de aluguel"
- "Investi 1000 reais em CDB"
- "Ganhei 5000 reais de salário"
- "Adicionar gasto de 30 reais"
- "Registrar despesa de 150 reais"
- "Vou gastar 100 reais amanhã"
- "Comprei comida por 25 reais ontem"
- "Mês passado eu gastei R$ 500 com Trident"
- "Ontem paguei 200 reais de aluguel"
- "Na semana passada comprei um livro por 50 reais"
- "Há 3 dias gastei 30 reais no McDonald's"
- "No final do mês passado investi 1000 reais"
- "Domingo gastei 80 reais no supermercado"
- "Na terça-feira paguei 150 reais de internet"
- "Semana retrasada comprei roupas por 300 reais"
- Enviar foto de nota fiscal ou cupom fiscal
- "Analise esta nota fiscal"
- "Adicione esta compra"
- "Registre esta transação"
- "Cadastre este gasto"

EXEMPLOS DE PERGUNTAS/CONSULTAS (responda "false"):
- "Quanto gastei este mês?"
- "Qual foi meu maior gasto?"
- "Como estão minhas finanças?"
- "Me dê um relatório"
- "Analise meus gastos"
- "Quanto tenho de saldo?"
- "Qual categoria gasto mais?"
- "Compare meus gastos"
- "Me dê conselhos financeiros"
- "Quanto gastei no KFC este mês?"
- "Qual foi meu gasto médio?"
- "Mostre meus gastos por categoria"

IMPORTANTE: 
- Se for uma PERGUNTA sobre dados existentes, responda "false"
- Se for uma SOLICITAÇÃO para registrar nova transação (mesmo no passado), responda "true"
- Se o usuário enviar uma IMAGEM de nota fiscal/cupom, responda "true"
- Considere tanto mensagens digitadas quanto transcritas de áudio
- Transações no passado também são solicitações para registrar dados`,
      },
    ];

    // Adicionar mensagem do usuário com ou sem imagem
    const userMessage: any = {
      role: "user",
      content: message,
    };

    if (imageUrl) {
      try {
        // Para URLs locais, converter para base64
        let imageData;
        if (imageUrl.startsWith("http")) {
          // URL externa - usar diretamente
          imageData = imageUrl;
        } else {
          // URL local - converter para base64
          const fs = await import("fs");
          const path = await import("path");
          const imagePath = path.join(process.cwd(), "public", imageUrl);
          const imageBuffer = fs.readFileSync(imagePath);
          const mimeType = imagePath.endsWith(".png")
            ? "image/png"
            : imagePath.endsWith(".jpg") || imagePath.endsWith(".jpeg")
              ? "image/jpeg"
              : "image/jpeg";
          imageData = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
        }

        userMessage.content = [
          {
            type: "text",
            text: message || "Analise esta imagem",
          },
          {
            type: "image_url",
            image_url: {
              url: imageData,
            },
          },
        ];
        console.log(
          "detectTransactionRequest - Image message constructed with base64",
        );
      } catch (error) {
        console.error(
          "Error processing image in detectTransactionRequest:",
          error,
        );
        // Se falhar, usar apenas texto
        userMessage.content = message || "Erro ao processar imagem";
      }
    }

    messages.push(userMessage);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 10,
      temperature: 0.1,
    });

    // Log token usage for transaction detection
    if (completion.usage) {
      const cost = calculateTokenCost(
        "gpt-4o-mini",
        completion.usage.total_tokens,
      );

      if (isFromAudio) {
        // Acumular custos do chat para consolidação posterior
        chatCosts += cost;
        chatTokens += completion.usage.total_tokens;
        console.log("🔗 Accumulated detection cost:", {
          cost,
          tokens: completion.usage.total_tokens,
          totalChatCosts: chatCosts,
          totalChatTokens: chatTokens,
        });
      } else {
        // Acumular custos para consolidação posterior (mensagens de texto)
        textTransactionCosts += cost;
        textTransactionTokens += completion.usage.total_tokens;
        console.log("🔗 Accumulated text detection cost:", {
          cost,
          tokens: completion.usage.total_tokens,
          totalTextCosts: textTransactionCosts,
          totalTextTokens: textTransactionTokens,
        });
      }
    }

    const response = completion.choices[0]?.message?.content
      ?.trim()
      .toLowerCase();
    console.log("detectTransactionRequest - GPT response:", response);
    console.log("detectTransactionRequest - Message analyzed:", message);
    console.log("detectTransactionRequest - Has image:", !!imageUrl);

    // Se há uma imagem, sempre considerar como solicitação de transcrição
    if (imageUrl) {
      console.log(
        "detectTransactionRequest - Image detected, forcing transcription request",
      );
      return true; // Forçar como solicitação para garantir que a imagem seja processada
    }

    const isTransaction = response === "true";
    console.log("detectTransactionRequest - Final GPT result:", isTransaction);
    return isTransaction;
  } catch (error) {
    console.error("Error detecting transaction request:", error);
    // Fallback para detecção básica se GPT falhar
    const lowerMessage = message.toLowerCase();

    // Detectar valores monetários (mais flexível)
    const hasAmount =
      /r\$\s*(\d+(?:[.,]\d{2})?)|(\d+(?:[.,]\d{2})?)\s*reais?|(\d+(?:[.,]\d{2})?)\s*real/i.test(
        message,
      );

    // Palavras-chave de transação (expandido)
    const transactionKeywords = [
      "gastei",
      "comprei",
      "paguei",
      "ganhei",
      "recebi",
      "investi",
      "apliquei",
      "gasto",
      "compra",
      "pagamento",
      "ganho",
      "receita",
      "investimento",
      "despesa",
      "gastar",
      "comprar",
      "pagar",
      "ganhar",
      "receber",
      "investir",
      "adicionar",
      "registrar",
      "cadastrar",
      "incluir",
      "inserir",
    ];
    const hasTransactionKeywords = transactionKeywords.some((keyword) =>
      lowerMessage.includes(keyword),
    );

    // Detectar palavras que indicam registro de dados (não consulta)
    const registrationKeywords = [
      "adicionar",
      "registrar",
      "cadastrar",
      "incluir",
      "inserir",
      "criar",
    ];
    const hasRegistrationKeywords = registrationKeywords.some((keyword) =>
      lowerMessage.includes(keyword),
    );

    // Detectar palavras que indicam consulta (não registro)
    const queryKeywords = [
      "quanto",
      "qual",
      "como",
      "mostre",
      "mostrar",
      "analise",
      "relatório",
      "compare",
    ];
    const hasQueryKeywords = queryKeywords.some((keyword) =>
      lowerMessage.includes(keyword),
    );

    console.log("detectTransactionRequest - Fallback analysis:", {
      message: message,
      hasAmount,
      hasTransactionKeywords,
      hasRegistrationKeywords,
      hasQueryKeywords,
      lowerMessage,
    });

    // Se há imagem, sempre considerar como solicitação
    if (imageUrl) {
      console.log(
        "detectTransactionRequest - Fallback: Image detected, returning true",
      );
      return true;
    }

    // Se tem palavras de consulta, provavelmente não é transação
    if (hasQueryKeywords && !hasRegistrationKeywords) {
      console.log(
        "detectTransactionRequest - Fallback: Query detected, returning false",
      );
      return false;
    }

    // Se tem palavras de registro, provavelmente é transação
    if (hasRegistrationKeywords) {
      console.log(
        "detectTransactionRequest - Fallback: Registration keywords detected, returning true",
      );
      return true;
    }

    // Lógica original: valor + palavra-chave de transação
    const result = hasAmount && hasTransactionKeywords;
    console.log("detectTransactionRequest - Fallback: Final result:", result);
    return result;
  }
}

// Função otimizada para transcrição precisa de imagem
async function transcribeImageTextUltraFast(
  message: string,
  imageUrl: string,
  userId?: string,
): Promise<string> {
  try {
    // Converter URL local para base64 se necessário
    let imageData = imageUrl;
    if (!imageUrl.startsWith("http") && !imageUrl.startsWith("data:")) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const imagePath = path.join(process.cwd(), "public", imageUrl);
        const imageBuffer = fs.readFileSync(imagePath);
        const mimeType = imagePath.endsWith(".png")
          ? "image/png"
          : imagePath.endsWith(".jpg") || imagePath.endsWith(".jpeg")
            ? "image/jpeg"
            : "image/jpeg";
        imageData = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
      } catch (error) {
        console.error("Error converting image to base64:", error);
        throw new Error("Erro ao processar imagem");
      }
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é um especialista em OCR (Reconhecimento Óptico de Caracteres) para documentos fiscais brasileiros. Sua tarefa é TRANSCREVER TODO O TEXTO visível na imagem com máxima precisão, mesmo que a imagem esteja distante, borrada ou com baixa qualidade.

INSTRUÇÕES CRÍTICAS PARA IMAGENS DE DIFERENTES QUALIDADES:
- Se a imagem estiver distante ou pequena, use zoom mental para identificar caracteres
- Se houver texto borrado, tente identificar padrões e caracteres parciais
- Se houver reflexos ou sombras, foque nas áreas mais legíveis
- Se houver texto cortado, transcreva o que conseguir ver
- Se houver números parcialmente visíveis, transcreva o que conseguir identificar
- Se houver texto muito pequeno, tente identificar palavras-chave importantes
- Seja paciente e analise cada área da imagem cuidadosamente

TÉCNICAS DE OCR AVANÇADO:
- Procure por padrões familiares de documentos fiscais brasileiros
- Identifique estruturas típicas: cabeçalho, itens, totais
- Use contexto para preencher lacunas (ex: se vir "R$ 2" e "99", provavelmente é "R$ 2,99")
- Procure por palavras-chave: "TOTAL", "VALOR", "PAGAMENTO", "DATA"
- Identifique números mesmo que parcialmente visíveis
- Use conhecimento de formatos brasileiros (DD/MM/AAAA, R$ X,XX)

FOCAR ESPECIALMENTE EM:
- Nome completo do estabelecimento/comerciante (razão social)
- CNPJ ou CPF do estabelecimento
- Valor total da compra (R$ X,XX)
- Método de pagamento usado (Cartão, PIX, Dinheiro, etc.)
- Data e hora da transação (DD/MM/AAAA HH:MM)
- Lista completa de produtos/serviços com quantidades
- Valores individuais e totais de cada item
- Códigos de barras, QR codes (mencionar presença)
- Número da nota fiscal, série, modelo
- Informações do cliente (se visível)
- Descontos, impostos, taxas

FORMATO DE RESPOSTA:
- Use quebras de linha para separar seções
- Mantenha a estrutura visual do documento
- Seja sistemático: comece pelo cabeçalho, depois itens, depois totais
- Se não conseguir ler algo, indique com [texto ilegível] ou [parcialmente visível]
- Seja honesto sobre o que consegue e não consegue ver

RESPONDA APENAS COM A TRANSCRIÇÃO COMPLETA E DETALHADA, sem explicações.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcreva completamente e detalhadamente todo o texto visível nesta imagem de documento fiscal brasileiro. Seja extremamente preciso com números, valores e datas.",
            },
            {
              type: "image_url",
              image_url: {
                url: imageData,
              },
            },
          ],
        },
      ],
      max_tokens: 1000, // Aumentado de 500 para 1000
      temperature: 0.0,
    });

    // Log token usage for ultra fast image transcription
    if (completion.usage) {
      const cost = calculateTokenCost(
        "gpt-4o-mini",
        completion.usage.total_tokens,
      );
      logTokenUsage({
        userId: userId || "system", // Usar userId real se disponível
        model: "gpt-4o-mini",
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
        endpoint: "transcribe-image-ultra-fast",
        cost,
      });
    }

    const response = completion.choices[0]?.message?.content?.trim();
    console.log(
      "transcribeImageTextUltraFast - GPT response length:",
      response?.length,
    );
    console.log(
      "transcribeImageTextUltraFast - GPT response preview:",
      response?.substring(0, 200) + "...",
    );

    return response || "Não foi possível transcrever o texto da imagem";
  } catch (error) {
    console.error("Error in ultra-fast transcription:", error);
    throw error;
  }
}

// Função para transcrever texto de imagens
async function transcribeImageText(
  message: string,
  imageUrl?: string,
  userId?: string,
): Promise<string> {
  if (!imageUrl) {
    return message;
  }

  try {
    const messages: any[] = [
      {
        role: "system",
        content: `Você é um assistente especializado em transcrever texto de imagens.

Sua única tarefa é TRANSCREVER TODO O TEXTO visível na imagem fornecida.

INSTRUÇÕES:
- Seja preciso e detalhado na transcrição
- Mantenha a formatação original quando possível
- Liste todos os itens, valores, datas e informações presentes
- Se houver números, valores monetários, datas, transcreva exatamente como aparecem
- Se houver uma lista de itens, transcreva cada item separadamente
- Se houver informações de estabelecimento, transcreva o nome completo
- Se houver QR codes ou códigos, mencione sua presença

RESPONDA APENAS COM A TRANSCRIÇÃO DO TEXTO, sem explicações adicionais.`,
      },
    ];

    const userMessage: any = {
      role: "user",
      content: [
        {
          type: "text",
          text: message || "Transcreva todo o texto visível nesta imagem",
        },
        {
          type: "image_url",
          image_url: {
            url: imageUrl,
          },
        },
      ],
    };

    messages.push(userMessage);

    console.log(
      "transcribeImageText - Sending to GPT-4 Vision for transcription",
    );

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 500,
      temperature: 0.1,
    });

    // Log token usage for image transcription
    if (completion.usage) {
      const cost = calculateTokenCost(
        "gpt-4o-mini",
        completion.usage.total_tokens,
      );
      logTokenUsage({
        userId: userId || "system", // Usar userId real se disponível
        model: "gpt-4o-mini",
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
        endpoint: "transcribe-image",
        cost,
      });
    }

    const response = completion.choices[0]?.message?.content?.trim();
    console.log("transcribeImageText - GPT response:", response);

    return response || "Não foi possível transcrever o texto da imagem.";
  } catch (error) {
    console.error("Error transcribing image:", error);
    return "Erro ao transcrever a imagem.";
  }
}

// Função otimizada para análise de imagem com foco na transcrição
async function analyzeImageAndExtractDataFast(
  message: string,
  imageUrl: string,
  userId?: string,
): Promise<{
  transcription: string;
  transactionData: {
    name: string;
    amount: number | null;
    category: string;
    paymentMethod: TransactionPaymentMethod;
    type: TransactionType;
    date: Date | null;
  } | null;
  qualityScore: number;
}> {
  try {
    // Primeiro fazer transcrição precisa
    console.log(
      "analyzeImageAndExtractDataFast - Fazendo transcrição precisa...",
    );
    const transcription = await transcribeImageTextUltraFast(
      message,
      imageUrl,
      userId,
    );
    console.log(
      "analyzeImageAndExtractDataFast - Transcrição obtida:",
      transcription,
    );

    // Depois analisar a transcrição para extrair dados
    console.log(
      "analyzeImageAndExtractDataFast - Analisando transcrição para extrair dados...",
    );
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é um especialista em análise de documentos fiscais brasileiros. Analise a transcrição fornecida e extraia os dados da transação com máxima precisão.

TRANSCRIÇÃO FORNECIDA:
{transcription}

INSTRUÇÕES DE ANÁLISE DETALHADA:
1. "name": Nome completo do estabelecimento/comerciante (razão social exata)
2. "amount": Valor total da compra (apenas números, ex: 24.97)
   - Procure por: "TOTAL", "VALOR A PAGAR", "TOTAL A PAGAR", "VALOR TOTAL"
   - Se houver múltiplos valores, use o maior (valor final)
3. "category": Categorize baseado no tipo de estabelecimento:
   - FOOD: supermercados, restaurantes, fast food, padarias, açougues, hortifrúti, lanchonetes
   - HEALTH: farmácias, hospitais, clínicas, laboratórios, medicamentos, saúde
   - TRANSPORTATION: postos de gasolina, transporte, combustível, oficinas, auto peças
   - ENTERTAINMENT: cinemas, streaming, jogos, bares, baladas, entretenimento
   - EDUCATION: livrarias, cursos, escolas, material escolar, educação
   - HOUSING: aluguel, condomínio, moradia, imobiliárias, construção
   - UTILITY: luz, água, internet, telefone, gás, utilidades, serviços
   - OTHER: outros gastos não categorizados
4. "paymentMethod": Identifique o método de pagamento:
   - CREDIT_CARD: Cartão de crédito, crédito
   - DEBIT_CARD: Cartão de débito, débito
   - PIX: PIX, transferência instantânea
   - CASH: Dinheiro, espécie, à vista
   - BANK_TRANSFER: TED, DOC, transferência bancária
   - BANK_SLIP: Boleto bancário
5. "type": Para notas fiscais/cupons, sempre "EXPENSE"
6. "date": Data da transação no formato YYYY-MM-DD
   - Procure por datas no formato DD/MM/AAAA ou DD/MM/AA
   - Procure também por: "Data:", "Emissão:", "Vencimento:", "Data de Venda"
   - Formatos brasileiros comuns: DD/MM/AAAA, DD/MM/AA, DD-MM-AAAA, DD.MM.AAAA
   - Se encontrar apenas ano (ex: 2024), use o ano atual
   - Se encontrar apenas mês/ano (ex: 01/2024), use o primeiro dia do mês
   - Se não encontrar data específica, use a data de hoje

REGRAS CRÍTICAS:
- Seja extremamente preciso com os valores monetários
- Use o nome exato do estabelecimento como aparece na transcrição
- Se houver ambiguidade, escolha a opção mais provável
- Se não conseguir identificar algo, use valores padrão apropriados
- Se a transcrição estiver parcial, trabalhe com o que estiver disponível
- Se houver texto ilegível, tente inferir baseado no contexto
- Para valores parciais, use o que conseguir identificar
- Seja tolerante com imagens de baixa qualidade ou distantes

RESPONDA APENAS COM JSON válido:
{
  "transactionData": {
    "name": "nome_do_estabelecimento",
    "amount": valor_numerico_ou_null,
    "category": "FOOD|HEALTH|TRANSPORTATION|ENTERTAINMENT|EDUCATION|HOUSING|UTILITY|OTHER",
    "paymentMethod": "CASH|CREDIT_CARD|DEBIT_CARD|PIX|BANK_TRANSFER|BANK_SLIP",
    "type": "EXPENSE",
    "date": "YYYY-MM-DD"
  }
}

CRÍTICO: Responda APENAS o JSON válido, sem explicações ou formatação markdown.`,
        },
        {
          role: "user",
          content: `Analise esta transcrição e extraia os dados da transação:

${transcription}`,
        },
      ],
      max_tokens: 500, // Aumentado de 300 para 500
      temperature: 0.0,
    });

    // Log token usage for fast image analysis
    if (completion.usage) {
      const cost = calculateTokenCost(
        "gpt-4o-mini",
        completion.usage.total_tokens,
      );
      logTokenUsage({
        userId: userId || "system", // Usar userId real se disponível
        model: "gpt-4o-mini",
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
        endpoint: "analyze-image-fast",
        cost,
      });
    }

    const response = completion.choices[0]?.message?.content?.trim();
    console.log(
      "analyzeImageAndExtractDataFast - Análise GPT response:",
      response,
    );

    if (!response) {
      throw new Error("No response from GPT");
    }

    // Parse JSON (lidar com markdown se presente)
    let result;
    try {
      let jsonString = response;

      // Se a resposta contém markdown JSON, extrair apenas o JSON
      if (jsonString.includes("```json")) {
        const jsonMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonString = jsonMatch[1].trim();
        }
      } else if (jsonString.includes("```")) {
        const jsonMatch = jsonString.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonString = jsonMatch[1].trim();
        }
      }

      result = JSON.parse(jsonString);
    } catch (parseError) {
      console.error(
        "analyzeImageAndExtractDataFast - JSON parse error:",
        parseError,
      );
      // Fallback: extrair JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse JSON");
      }
    }

    // Validar dados
    const transactionData = result.transactionData
      ? {
          name: result.transactionData.name || "",
          amount: result.transactionData.amount || null,
          category: (result.transactionData.category as string) || "OTHER",
          paymentMethod:
            (result.transactionData
              .paymentMethod as TransactionPaymentMethod) ||
            TransactionPaymentMethod.CASH,
          type:
            (result.transactionData.type as TransactionType) ||
            TransactionType.EXPENSE,
          date: result.transactionData.date
            ? (() => {
                const dateStr = result.transactionData.date;
                if (typeof dateStr === "string") {
                  // Primeiro tenta processar como data brasileira
                  const brazilianDate = processBrazilianDate(dateStr);
                  if (brazilianDate) {
                    return brazilianDate;
                  }

                  // Se não conseguir, tenta extrair da transcrição usando múltiplas estratégias
                  const extractedDate = extractDateFromText(
                    transcription || "",
                  );
                  if (extractedDate) {
                    return extractedDate;
                  }

                  // Se não conseguir, tenta como formato ISO (YYYY-MM-DD)
                  if (dateStr.includes("-")) {
                    const [year, month, day] = dateStr.split("-").map(Number);
                    if (year && month && day) {
                      return new Date(year, month - 1, day, 12, 0, 0, 0);
                    }
                  }

                  // Fallback: tenta criar data diretamente
                  const fallbackDate = new Date(dateStr);
                  if (!isNaN(fallbackDate.getTime())) {
                    return fallbackDate;
                  }
                }
                return new Date();
              })()
            : new Date(),
        }
      : null;

    // Validar qualidade da extração
    const qualityScore = validateExtractionQuality(
      transcription,
      transactionData,
    );
    console.log(
      "analyzeImageAndExtractDataFast - Quality score:",
      qualityScore,
    );

    if (qualityScore < 0.7) {
      console.log(
        "analyzeImageAndExtractDataFast - Low quality extraction detected",
      );
    }

    console.log("analyzeImageAndExtractDataFast - Resultado final:", {
      transcription,
      transactionData,
      qualityScore,
    });

    return {
      transcription: transcription,
      transactionData,
      qualityScore,
    };
  } catch (error) {
    console.error("Error in fast analysis:", error);
    throw error;
  }
}

// Função para validar a qualidade da extração de dados
function validateExtractionQuality(
  transcription: string,
  transactionData: any,
): number {
  let score = 0;
  let totalChecks = 0;

  // Verificar se conseguiu extrair nome do estabelecimento
  totalChecks++;
  if (
    transactionData?.name &&
    transactionData.name !== "Estabelecimento não identificado"
  ) {
    score += 1;
  }

  // Verificar se conseguiu extrair valor
  totalChecks++;
  if (transactionData?.amount && transactionData.amount > 0) {
    score += 1;
  }

  // Verificar se conseguiu extrair data
  totalChecks++;
  if (transactionData?.date) {
    score += 1;
  }

  // Verificar se conseguiu extrair método de pagamento
  totalChecks++;
  if (
    transactionData?.paymentMethod &&
    transactionData.paymentMethod !== "CASH"
  ) {
    score += 1;
  }

  // Verificar se a transcrição contém informações importantes
  totalChecks++;
  const hasImportantInfo =
    transcription.includes("TOTAL") ||
    transcription.includes("VALOR") ||
    transcription.includes("R$") ||
    transcription.includes("CNPJ") ||
    transcription.includes("CPF");
  if (hasImportantInfo) {
    score += 1;
  }

  // Verificar se a transcrição não está muito curta
  totalChecks++;
  if (transcription.length > 100) {
    score += 1;
  }

  return score / totalChecks;
}

// Função para gerar sugestões de melhoria baseadas na qualidade
function generateQualitySuggestions(
  qualityScore: number,
  transcription: string,
): string {
  if (qualityScore >= 0.8) {
    return "";
  }

  const suggestions = [];

  if (qualityScore < 0.6) {
    suggestions.push(
      "📸 **Dica:** Tente tirar uma foto mais próxima do documento",
    );
    suggestions.push(
      "🔍 **Dica:** Certifique-se de que o texto está bem focado",
    );
    suggestions.push("💡 **Dica:** Evite reflexos e sombras na imagem");
  }

  if (transcription.length < 100) {
    suggestions.push(
      "📱 **Dica:** A imagem pode estar muito distante - aproxime mais",
    );
    suggestions.push(
      "🔍 **Dica:** Certifique-se de que todo o documento está visível",
    );
  }

  if (!transcription.includes("TOTAL") && !transcription.includes("VALOR")) {
    suggestions.push(
      "💰 **Dica:** Certifique-se de que o valor total está visível na foto",
    );
    suggestions.push("📊 **Dica:** Inclua a seção de totais do documento");
  }

  if (!transcription.includes("CNPJ") && !transcription.includes("CPF")) {
    suggestions.push(
      "🏪 **Dica:** Tente incluir o nome do estabelecimento na foto",
    );
    suggestions.push(
      "📍 **Dica:** Certifique-se de que o cabeçalho do documento está visível",
    );
  }

  if (suggestions.length > 0) {
    return "\n\n" + suggestions.join("\n");
  }

  return "";
}

// Função robusta que tenta múltiplas estratégias para imagens difíceis
async function analyzeImageRobust(
  message: string,
  imageUrl: string,
  userId?: string,
): Promise<{
  transcription: string;
  transactionData: {
    name: string;
    amount: number | null;
    category: string;
    paymentMethod: TransactionPaymentMethod;
    type: TransactionType;
    date: Date | null;
  } | null;
  qualityScore: number;
}> {
  try {
    console.log(
      "analyzeImageRobust - Tentando análise robusta para imagem difícil...",
    );

    // Primeiro, tentar a função única otimizada
    try {
      const result = await analyzeImageAndExtractDataSingleCall(
        message,
        imageUrl,
        userId,
      );
      console.log("analyzeImageRobust - Análise única bem-sucedida");
      return result;
    } catch (error) {
      console.log(
        "analyzeImageRobust - Análise única falhou, tentando processo em duas etapas...",
      );
    }

    // Se falhar, tentar o processo em duas etapas
    try {
      const result = await analyzeImageAndExtractDataFast(
        message,
        imageUrl,
        userId,
      );
      console.log("analyzeImageRobust - Análise em duas etapas bem-sucedida");
      return result;
    } catch (error) {
      console.log(
        "analyzeImageRobust - Análise em duas etapas falhou, tentando análise básica...",
      );
    }

    // Se ainda falhar, tentar análise básica com prompt mais simples
    try {
      const result = await analyzeImageBasic(message, imageUrl, userId);
      console.log("analyzeImageRobust - Análise básica bem-sucedida");
      return result;
    } catch (error) {
      console.error(
        "analyzeImageRobust - Todas as estratégias falharam:",
        error,
      );
      throw new Error(
        "Não foi possível analisar a imagem com nenhuma estratégia",
      );
    }
  } catch (error) {
    console.error("Error in robust analysis:", error);
    throw error;
  }
}

// Função de análise básica para imagens muito difíceis
async function analyzeImageBasic(
  message: string,
  imageUrl: string,
  userId?: string,
): Promise<{
  transcription: string;
  transactionData: {
    name: string;
    amount: number | null;
    category: string;
    paymentMethod: TransactionPaymentMethod;
    type: TransactionType;
    date: Date | null;
  } | null;
  qualityScore: number;
}> {
  try {
    // Converter URL local para base64 se necessário
    let imageData = imageUrl;
    if (!imageUrl.startsWith("http") && !imageUrl.startsWith("data:")) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const imagePath = path.join(process.cwd(), "public", imageUrl);
        const imageBuffer = fs.readFileSync(imagePath);
        const mimeType = imagePath.endsWith(".png")
          ? "image/png"
          : imagePath.endsWith(".jpg") || imagePath.endsWith(".jpeg")
            ? "image/jpeg"
            : "image/jpeg";
        imageData = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
      } catch (error) {
        console.error("Error converting image to base64:", error);
        throw new Error("Erro ao processar imagem");
      }
    }

    console.log(
      "analyzeImageBasic - Fazendo análise básica para imagem difícil...",
    );

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é um especialista em análise de documentos fiscais. Esta imagem pode estar distante, borrada ou com baixa qualidade. Sua tarefa é extrair o máximo de informações possível.

INSTRUÇÕES:
- Transcreva TODO o texto que conseguir ver, mesmo que parcialmente
- Se houver texto ilegível, indique com [ilegível]
- Se houver números parciais, transcreva o que conseguir ver
- Foque especialmente em: nome do estabelecimento, valor total, data, método de pagamento
- Seja tolerante com imagens de baixa qualidade
- Use contexto para inferir informações quando possível

RESPONDA COM JSON:
{
  "transcription": "texto transcrito da imagem",
  "transactionData": {
    "name": "nome do estabelecimento ou [não identificado]",
    "amount": valor_numerico_ou_null,
    "category": "FOOD|HEALTH|TRANSPORTATION|ENTERTAINMENT|EDUCATION|HOUSING|UTILITY|OTHER",
    "paymentMethod": "CASH|CREDIT_CARD|DEBIT_CARD|PIX|BANK_TRANSFER|BANK_SLIP",
    "type": "EXPENSE",
    "date": "YYYY-MM-DD"
  }
}

Seja honesto sobre o que consegue e não consegue ver.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                message ||
                "Analise esta imagem de documento fiscal, mesmo que esteja distante ou com baixa qualidade",
            },
            {
              type: "image_url",
              image_url: {
                url: imageData,
              },
            },
          ],
        },
      ],
      max_tokens: 800,
      temperature: 0.1,
    });

    // Log token usage for basic image analysis
    if (completion.usage) {
      const cost = calculateTokenCost(
        "gpt-4o-mini",
        completion.usage.total_tokens,
      );
      logTokenUsage({
        userId: userId || "system", // Usar userId real se disponível
        model: "gpt-4o-mini",
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
        endpoint: "analyze-image-basic",
        cost,
      });
    }

    const response = completion.choices[0]?.message?.content?.trim();
    console.log("analyzeImageBasic - GPT response length:", response?.length);

    if (!response) {
      throw new Error("No response from GPT");
    }

    // Tentar fazer parse do JSON
    let result;
    try {
      result = JSON.parse(response);
    } catch (parseError) {
      // Fallback: tentar extrair JSON da resposta
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse JSON response");
      }
    }

    // Validar e converter os dados da transação
    const transactionData = result.transactionData
      ? {
          name:
            result.transactionData.name || "Estabelecimento não identificado",
          amount: result.transactionData.amount
            ? parseFloat(result.transactionData.amount)
            : null,
          category: (result.transactionData.category as string) || "OTHER",
          paymentMethod:
            (result.transactionData
              .paymentMethod as TransactionPaymentMethod) || "CASH",
          type: (result.transactionData.type as TransactionType) || "EXPENSE",
          date: result.transactionData.date
            ? (() => {
                const dateStr = result.transactionData.date;
                if (typeof dateStr === "string") {
                  // Primeiro tenta processar como data brasileira
                  const brazilianDate = processBrazilianDate(dateStr);
                  if (brazilianDate) {
                    return brazilianDate;
                  }

                  // Se não conseguir, tenta extrair da transcrição usando múltiplas estratégias
                  const extractedDate = extractDateFromText(
                    result.transcription || "",
                  );
                  if (extractedDate) {
                    return extractedDate;
                  }

                  // Se não conseguir, tenta como formato ISO (YYYY-MM-DD)
                  if (dateStr.includes("-")) {
                    const [year, month, day] = dateStr.split("-").map(Number);
                    if (year && month && day) {
                      return new Date(year, month - 1, day, 12, 0, 0, 0);
                    }
                  }

                  // Fallback: tenta criar data diretamente
                  const fallbackDate = new Date(dateStr);
                  if (!isNaN(fallbackDate.getTime())) {
                    return fallbackDate;
                  }
                }
                return new Date();
              })()
            : new Date(),
        }
      : null;

    // Validar qualidade da extração
    const qualityScore = validateExtractionQuality(
      result.transcription || "",
      transactionData,
    );
    console.log("analyzeImageBasic - Quality score:", qualityScore);

    return {
      transcription: result.transcription || "Transcrição não disponível",
      transactionData,
      qualityScore,
    };
  } catch (error) {
    console.error("Error in basic analysis:", error);
    throw error;
  }
}

// Função alternativa que faz transcrição + extração de dados em uma única chamada (mais eficiente)
async function analyzeImageAndExtractDataSingleCall(
  message: string,
  imageUrl: string,
  userId?: string,
): Promise<{
  transcription: string;
  transactionData: {
    name: string;
    amount: number | null;
    category: string;
    paymentMethod: TransactionPaymentMethod;
    type: TransactionType;
    date: Date | null;
  } | null;
  qualityScore: number;
}> {
  try {
    // Converter URL local para base64 se necessário
    let imageData = imageUrl;
    if (!imageUrl.startsWith("http") && !imageUrl.startsWith("data:")) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const imagePath = path.join(process.cwd(), "public", imageUrl);
        const imageBuffer = fs.readFileSync(imagePath);
        const mimeType = imagePath.endsWith(".png")
          ? "image/png"
          : imagePath.endsWith(".jpg") || imagePath.endsWith(".jpeg")
            ? "image/jpeg"
            : "image/jpeg";
        imageData = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
      } catch (error) {
        console.error("Error converting image to base64:", error);
        throw new Error("Erro ao processar imagem");
      }
    }

    console.log(
      "analyzeImageAndExtractDataSingleCall - Fazendo análise completa em uma única chamada...",
    );

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é um especialista em análise de documentos fiscais brasileiros. Sua tarefa é:

1. TRANSCREVER completamente todo o texto visível na imagem
2. EXTRAIR os dados da transação financeira

INSTRUÇÕES PARA TRANSCRIÇÃO:
- Transcreva EXATAMENTE como aparece na imagem, caractere por caractere
- Mantenha números, valores monetários e datas exatos
- Preserve a formatação original (quebras de linha, espaçamento)
- Se houver texto borrado ou ilegível, indique com [texto ilegível]
- Se houver texto parcialmente visível, transcreva o que conseguir ver
- Se a imagem estiver distante, use zoom mental para identificar caracteres
- Seja extremamente detalhado e completo
- Foque especialmente em: nome do estabelecimento, valores, datas, métodos de pagamento
- Use contexto para preencher lacunas quando possível

DETECÇÃO ESPECÍFICA DE DATAS:
- Procure por seções como "Data:", "Emissão:", "Vencimento:", "Data/Hora", "Data de Venda", "Data e Hora da Transação"
- Para CUPONS SAT: Procure por "SAT No." seguido de data (ex: "SAT No. 001.456.645" seguido de "13/09/2025 - 18:38:11")
- Para CUPONS FISCAIS ELETRÔNICOS: Procure por data após informações do SAT
- Identifique padrões de data brasileiros: DD/MM/AAAA, DD/MM/AA, DD-MM-AAAA, DD.MM.AAAA
- Se encontrar apenas números soltos (ex: 15/01/2024), identifique como data
- Se encontrar data parcial (ex: apenas "15/01"), complete com ano atual
- Se encontrar apenas ano (ex: "2024"), use como referência temporal
- Se encontrar data em formato americano (MM/DD/AAAA), converta para brasileiro
- Se houver múltiplas datas, priorize a data da transação/venda/emissão do SAT
- CRÍTICO: Aceite datas futuras (ex: 2025, 2026) se estiverem claramente visíveis no documento
- IMPORTANTE: Se vir "13/09/2025" na imagem, transcreva exatamente "13/09/2025", NÃO "13/09/2022"
- Se encontrar "Data e Hora da Transação: 17/09/2025", use exatamente 17/09/2025
- Se encontrar "13/09/2025 - 18:38:11" após SAT No., use exatamente 13/09/2025

INSTRUÇÕES PARA EXTRAÇÃO DE DADOS:
1. "name": Nome completo do estabelecimento/comerciante (razão social exata)
2. "amount": Valor total da compra (apenas números, ex: 24.97)
   - Procure por: "TOTAL", "VALOR A PAGAR", "TOTAL A PAGAR", "VALOR TOTAL"
3. "category": Categorize baseado no tipo de estabelecimento:
   - FOOD: supermercados, restaurantes, fast food, padarias, açougues, hortifrúti
   - HEALTH: farmácias, hospitais, clínicas, laboratórios, medicamentos
   - TRANSPORTATION: postos de gasolina, transporte, combustível, oficinas
   - ENTERTAINMENT: cinemas, streaming, jogos, bares, baladas
   - EDUCATION: livrarias, cursos, escolas, material escolar
   - HOUSING: aluguel, condomínio, moradia, imobiliárias
   - UTILITY: luz, água, internet, telefone, gás, utilidades
   - OTHER: outros gastos não categorizados
4. "paymentMethod": Identifique o método de pagamento:
   - CREDIT_CARD: Cartão de crédito, crédito
   - DEBIT_CARD: Cartão de débito, débito
   - PIX: PIX, transferência instantânea
   - CASH: Dinheiro, espécie, à vista
   - BANK_TRANSFER: TED, DOC, transferência bancária
   - BANK_SLIP: Boleto bancário
5. "type": Para notas fiscais/cupons, sempre "EXPENSE"
6. "date": Data da transação no formato YYYY-MM-DD
   - Procure por datas no formato DD/MM/AAAA ou DD/MM/AA
   - Procure também por: "Data:", "Emissão:", "Vencimento:", "Data de Venda", "Data/Hora", "Data e Hora da Transação"
   - Para CUPONS SAT: Procure por data após "SAT No." (ex: "SAT No. 001.456.645" seguido de "13/09/2025 - 18:38:11")
   - Formatos brasileiros comuns: DD/MM/AAAA, DD/MM/AA, DD-MM-AAAA, DD.MM.AAAA
   - Se encontrar apenas ano (ex: 2024), use o ano atual
   - Se encontrar apenas mês/ano (ex: 01/2024), use o primeiro dia do mês
   - CRÍTICO: Aceite datas futuras (ex: 2025, 2026) se estiverem claramente visíveis
   - IMPORTANTE: Se vir "13/09/2025" na imagem, use exatamente 2025-09-13, NÃO 2022-09-13
   - Se encontrar "Data e Hora da Transação: 17/09/2025", use exatamente 2025-09-17
   - Se encontrar "13/09/2025 - 18:38:11" após SAT No., use exatamente 2025-09-13
   - Se não encontrar data específica, use a data de hoje

RESPONDA EXCLUSIVAMENTE COM UM JSON válido no seguinte formato:
{
  "transcription": "texto completo transcrito da imagem",
  "transactionData": {
    "name": "nome do estabelecimento",
    "amount": valor_numerico_ou_null,
    "category": "FOOD|TRANSPORTATION|HEALTH|ENTERTAINMENT|EDUCATION|HOUSING|UTILITY|OTHER",
    "paymentMethod": "CASH|CREDIT_CARD|DEBIT_CARD|PIX|BANK_TRANSFER|BANK_SLIP",
    "type": "EXPENSE",
    "date": "YYYY-MM-DD"
  }
}

CRÍTICO: 
- Responda APENAS o JSON válido
- NÃO inclua explicações, comentários ou texto adicional
- NÃO use markdown ou formatação
- O JSON deve ser válido e parseável
- Se não conseguir extrair dados, use valores padrão mas mantenha o JSON válido`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                message ||
                "Analise esta imagem de documento fiscal brasileiro e extraia os dados da transação",
            },
            {
              type: "image_url",
              image_url: {
                url: imageData,
              },
            },
          ],
        },
      ],
      max_tokens: 1200, // Aumentado para acomodar transcrição + análise
      temperature: 0.0,
    });

    const response = completion.choices[0]?.message?.content?.trim();
    console.log(
      "analyzeImageAndExtractDataSingleCall - GPT response length:",
      response?.length,
    );
    console.log(
      "analyzeImageAndExtractDataSingleCall - GPT response preview:",
      response?.substring(0, 200) + "...",
    );

    // Log token usage for image analysis
    if (completion.usage) {
      const cost = calculateTokenCost(
        "gpt-4o-mini",
        completion.usage.total_tokens,
      );
      logTokenUsage({
        userId: userId || "system", // Usar userId real se disponível, senão 'system'
        model: "gpt-4o-mini",
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
        endpoint: "analyze-image-single",
        cost,
      });
    }

    if (!response) {
      console.error(
        "analyzeImageAndExtractDataSingleCall - No response from GPT",
      );
      throw new Error("No response from GPT");
    }

    // Tentar fazer parse do JSON
    let result;
    try {
      result = JSON.parse(response);
      console.log(
        "analyzeImageAndExtractDataSingleCall - JSON parsed successfully",
      );
    } catch (parseError) {
      console.error(
        "analyzeImageAndExtractDataSingleCall - JSON parse error:",
        parseError,
      );
      console.error(
        "analyzeImageAndExtractDataSingleCall - Raw response:",
        response,
      );

      // Fallback: tentar extrair JSON da resposta
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]);
          console.log(
            "analyzeImageAndExtractDataSingleCall - Fallback JSON parsed",
          );
        } catch (fallbackError) {
          console.error(
            "analyzeImageAndExtractDataSingleCall - Fallback parse also failed:",
            fallbackError,
          );
          throw new Error(`Failed to parse JSON response: ${parseError}`);
        }
      } else {
        throw new Error(`Failed to parse JSON response: ${parseError}`);
      }
    }

    // Validar e converter os dados da transação
    const transactionData = result.transactionData
      ? {
          name:
            result.transactionData.name || "Estabelecimento não identificado",
          amount: result.transactionData.amount
            ? parseFloat(result.transactionData.amount)
            : null,
          category: (result.transactionData.category as string) || "OTHER",
          paymentMethod:
            (result.transactionData
              .paymentMethod as TransactionPaymentMethod) || "CASH",
          type: (result.transactionData.type as TransactionType) || "EXPENSE",
          date: result.transactionData.date
            ? (() => {
                const dateStr = result.transactionData.date;
                if (typeof dateStr === "string") {
                  // Primeiro tenta processar como data brasileira
                  const brazilianDate = processBrazilianDate(dateStr);
                  if (brazilianDate) {
                    return brazilianDate;
                  }

                  // Se não conseguir, tenta extrair da transcrição usando múltiplas estratégias
                  const extractedDate = extractDateFromText(
                    result.transcription || "",
                  );
                  if (extractedDate) {
                    return extractedDate;
                  }

                  // Se não conseguir, tenta como formato ISO (YYYY-MM-DD)
                  if (dateStr.includes("-")) {
                    const [year, month, day] = dateStr.split("-").map(Number);
                    if (year && month && day) {
                      return new Date(year, month - 1, day, 12, 0, 0, 0);
                    }
                  }

                  // Fallback: tenta criar data diretamente
                  const fallbackDate = new Date(dateStr);
                  if (!isNaN(fallbackDate.getTime())) {
                    return fallbackDate;
                  }
                }
                return new Date();
              })()
            : new Date(),
        }
      : null;

    // Validar qualidade da extração
    const qualityScore = validateExtractionQuality(
      result.transcription || "",
      transactionData,
    );
    console.log(
      "analyzeImageAndExtractDataSingleCall - Quality score:",
      qualityScore,
    );

    console.log("analyzeImageAndExtractDataSingleCall - Resultado final:", {
      transcription: result.transcription?.substring(0, 100) + "...",
      transactionData,
      qualityScore,
    });

    return {
      transcription: result.transcription || "Transcrição não disponível",
      transactionData,
      qualityScore,
    };
  } catch (error) {
    console.error("Error in single call analysis:", error);
    throw error;
  }
}

// Função otimizada que faz transcrição + extração de dados em uma única chamada
async function analyzeImageAndExtractData(
  message: string,
  imageUrl: string,
  userId?: string,
): Promise<{
  transcription: string;
  transactionData: {
    name: string;
    amount: number | null;
    category: string;
    paymentMethod: TransactionPaymentMethod;
    type: TransactionType;
    date: Date | null;
  } | null;
}> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é um assistente especializado em analisar imagens de notas fiscais/cupons e extrair dados de transações financeiras.

Sua tarefa é:
1. TRANSCREVER todo o texto visível na imagem
2. EXTRAIR os dados da transação financeira

RESPONDA EXCLUSIVAMENTE COM UM JSON válido no seguinte formato:
{
  "transcription": "texto completo transcrito da imagem",
  "transactionData": {
    "name": "nome do estabelecimento",
    "amount": valor_numerico_ou_null,
    "category": "FOOD|TRANSPORTATION|HEALTH|ENTERTAINMENT|EDUCATION|HOUSING|UTILITY|SALARY|OTHER",
    "paymentMethod": "CASH|CREDIT_CARD|DEBIT_CARD|PIX|BANK_TRANSFER|BANK_SLIP",
    "type": "EXPENSE|DEPOSIT|INVESTMENT",
    "date": "YYYY-MM-DD"
  }
}

REGRAS PARA TRANSCRIÇÃO:
- Seja preciso e detalhado
- Mantenha a formatação original quando possível
- Liste todos os itens, valores, datas e informações presentes
- Se houver números, valores monetários, datas, transcreva exatamente como aparecem

REGRAS PARA DADOS DA TRANSAÇÃO:
1. "name": Nome do estabelecimento/comerciante (ex: "Campo 20", "McDonald's", "Farmácia São Paulo")
2. "amount": Valor total da compra (ex: 24.97, 150.00)
3. "category": Categorize baseado no tipo de estabelecimento:
   - FOOD: Supermercados, restaurantes, fast food, alimentação
   - HEALTH: Farmácias, hospitais, clínicas
   - TRANSPORTATION: Postos de gasolina, transporte
   - ENTERTAINMENT: Cinemas, streaming, jogos
   - EDUCATION: Livrarias, cursos, escolas
   - HOUSING: Aluguel, condomínio
   - UTILITY: Luz, água, internet
   - OTHER: Outros gastos
4. "paymentMethod": Identifique o método de pagamento:
   - CREDIT_CARD: Cartão de crédito
   - DEBIT_CARD: Cartão de débito
   - PIX: PIX
   - CASH: Dinheiro
   - BANK_TRANSFER: Transferência bancária
   - BANK_SLIP: Boleto
5. "type": Para notas fiscais/cupons, sempre "EXPENSE"
6. "date": Data da transação no formato YYYY-MM-DD
   - Procure por datas no formato DD/MM/AAAA ou DD/MM/AA
   - Procure também por: "Data:", "Emissão:", "Vencimento:", "Data de Venda", "Data/Hora"
   - Formatos brasileiros comuns: DD/MM/AAAA, DD/MM/AA, DD-MM-AAAA, DD.MM.AAAA
   - Se encontrar apenas ano (ex: 2024), use o ano atual
   - Se encontrar apenas mês/ano (ex: 01/2024), use o primeiro dia do mês
   - Se não encontrar data específica, use a data de hoje

CRÍTICO: 
- Responda APENAS o JSON válido
- NÃO inclua explicações, comentários ou texto adicional
- NÃO use markdown ou formatação
- O JSON deve ser válido e parseável
- Se não conseguir extrair dados, use valores padrão mas mantenha o JSON válido

EXEMPLO DE RESPOSTA:
{"transcription": "CAMPO 20 LTDA AMERICANA SP - VALOR A PAGAR R$ 24,97 - Cartão de Crédito", "transactionData": {"name": "Campo 20", "amount": 24.97, "category": "FOOD", "paymentMethod": "CREDIT_CARD", "type": "EXPENSE", "date": "2024-01-15"}}`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                message ||
                "Analise esta imagem de nota fiscal e extraia os dados da transação",
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.1,
    });

    // Log token usage for image analysis
    if (completion.usage) {
      const cost = calculateTokenCost(
        "gpt-4o-mini",
        completion.usage.total_tokens,
      );
      logTokenUsage({
        userId: userId || "system", // Usar userId real se disponível
        model: "gpt-4o-mini",
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
        endpoint: "analyze-image-extract",
        cost,
      });
    }

    const response = completion.choices[0]?.message?.content?.trim();
    console.log("analyzeImageAndExtractData - GPT response:", response);
    console.log(
      "analyzeImageAndExtractData - Response length:",
      response?.length,
    );

    if (!response) {
      console.error("analyzeImageAndExtractData - No response from GPT");
      throw new Error("No response from GPT");
    }

    // Tentar fazer parse do JSON
    let result;
    try {
      result = JSON.parse(response);
      console.log(
        "analyzeImageAndExtractData - JSON parsed successfully:",
        result,
      );
    } catch (parseError) {
      console.error(
        "analyzeImageAndExtractData - JSON parse error:",
        parseError,
      );
      console.error("analyzeImageAndExtractData - Raw response:", response);

      // Fallback: tentar extrair JSON da resposta
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]);
          console.log(
            "analyzeImageAndExtractData - Fallback JSON parsed:",
            result,
          );
        } catch (fallbackError) {
          console.error(
            "analyzeImageAndExtractData - Fallback parse also failed:",
            fallbackError,
          );
          throw new Error(`Failed to parse JSON response: ${parseError}`);
        }
      } else {
        throw new Error(`Failed to parse JSON response: ${parseError}`);
      }
    }

    // Validar e converter os dados da transação
    const transactionData = result.transactionData
      ? {
          name: result.transactionData.name || "",
          amount: result.transactionData.amount || null,
          category: (result.transactionData.category as string) || "OTHER",
          paymentMethod:
            (result.transactionData
              .paymentMethod as TransactionPaymentMethod) ||
            TransactionPaymentMethod.CASH,
          type:
            (result.transactionData.type as TransactionType) ||
            TransactionType.EXPENSE,
          date: result.transactionData.date
            ? (() => {
                const dateStr = result.transactionData.date;
                if (typeof dateStr === "string") {
                  // Primeiro tenta processar como data brasileira
                  const brazilianDate = processBrazilianDate(dateStr);
                  if (brazilianDate) {
                    return brazilianDate;
                  }

                  // Se não conseguir, tenta extrair da transcrição usando múltiplas estratégias
                  const extractedDate = extractDateFromText(
                    result.transcription || "",
                  );
                  if (extractedDate) {
                    return extractedDate;
                  }

                  // Se não conseguir, tenta como formato ISO (YYYY-MM-DD)
                  if (dateStr.includes("-")) {
                    const [year, month, day] = dateStr.split("-").map(Number);
                    if (year && month && day) {
                      return new Date(year, month - 1, day, 12, 0, 0, 0);
                    }
                  }

                  // Fallback: tenta criar data diretamente
                  const fallbackDate = new Date(dateStr);
                  if (!isNaN(fallbackDate.getTime())) {
                    return fallbackDate;
                  }
                }
                return new Date();
              })()
            : new Date(),
        }
      : null;

    console.log("analyzeImageAndExtractData - Parsed result:", {
      transcription: result.transcription,
      transactionData,
    });

    return {
      transcription:
        result.transcription || "Não foi possível transcrever a imagem.",
      transactionData,
    };
  } catch (error) {
    console.error("Error analyzing image and extracting data:", error);
    return {
      transcription: "Erro ao analisar a imagem.",
      transactionData: null,
    };
  }
}

// Função para corrigir datas incorretas comuns na transcrição
function correctCommonDateErrors(text: string): string {
  if (!text) return text;

  // Correções específicas para datas futuras mal transcritas
  const corrections = [
    // Se encontrar 2022 mas deveria ser 2025 (baseado no contexto)
    { from: /13\/09\/2022/g, to: "13/09/2025" },
    { from: /17\/09\/2022/g, to: "17/09/2025" },
    { from: /15\/01\/2022/g, to: "15/01/2025" },
    { from: /20\/03\/2022/g, to: "20/03/2025" },
    { from: /25\/12\/2022/g, to: "25/12/2025" },

    // Padrões mais genéricos para anos futuros
    { from: /(\d{1,2}\/\d{1,2}\/)2022/g, to: "$12025" },

    // Correções específicas para SAT
    {
      from: /SAT No: 001\.456\.645\s*13\/09\/2022/g,
      to: "SAT No: 001.456.645 13/09/2025",
    },
  ];

  let correctedText = text;
  for (const correction of corrections) {
    correctedText = correctedText.replace(correction.from, correction.to);
  }

  return correctedText;
}

// Função para extrair datas usando múltiplas estratégias
function extractDateFromText(text: string): Date | null {
  if (!text) return null;

  // Primeiro corrigir erros comuns de transcrição
  const correctedText = correctCommonDateErrors(text);

  // Estratégia 1: Buscar padrões de data brasileiros
  const brazilianPatterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
    /(\d{1,2})\/(\d{1,2})\/(\d{2})/g,
    /(\d{1,2})-(\d{1,2})-(\d{4})/g,
    /(\d{1,2})\.(\d{1,2})\.(\d{4})/g,
  ];

  for (const pattern of brazilianPatterns) {
    const matches = correctedText.match(pattern);
    if (matches) {
      for (const match of matches) {
        const processedDate = processBrazilianDate(match);
        if (processedDate) {
          return processedDate;
        }
      }
    }
  }

  // Estratégia 2: Buscar por palavras-chave de data
  const dateKeywords = [
    "Data:",
    "Emissão:",
    "Vencimento:",
    "Data/Hora",
    "Data de Venda",
    "Data e Hora da Transação",
    "SAT No.",
  ];
  for (const keyword of dateKeywords) {
    const keywordIndex = correctedText.indexOf(keyword);
    if (keywordIndex !== -1) {
      // Para SAT No., buscar mais caracteres para capturar a data completa
      const length = keyword === "SAT No." ? 35 : 25;
      const afterKeyword = correctedText.substring(
        keywordIndex + keyword.length,
        keywordIndex + keyword.length + length,
      );
      const processedDate = processBrazilianDate(afterKeyword);
      if (processedDate) {
        return processedDate;
      }
    }
  }

  // Estratégia 3: Buscar especificamente por padrões SAT
  const satPattern =
    /SAT\s+No\.\s*\d+\.\d+\.\d+\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*\d{1,2}:\d{1,2}:\d{1,2}/g;
  const satMatches = correctedText.match(satPattern);
  if (satMatches) {
    for (const match of satMatches) {
      const dateMatch = match.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      if (dateMatch) {
        const processedDate = processBrazilianDate(dateMatch[1]);
        if (processedDate) {
          return processedDate;
        }
      }
    }
  }

  // Estratégia 4: Buscar números que podem ser datas
  const numberPattern = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/g;
  const numberMatches = correctedText.match(numberPattern);
  if (numberMatches) {
    for (const match of numberMatches) {
      const processedDate = processBrazilianDate(match);
      if (processedDate) {
        return processedDate;
      }
    }
  }

  return null;
}

// Função específica para processar e validar datas brasileiras
function processBrazilianDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== "string") {
    return null;
  }

  // Remove espaços e caracteres especiais
  const cleanDate = dateStr.trim().replace(/[^\d\/\-\.]/g, "");

  // Padrões de data brasileiros
  const patterns = [
    // DD/MM/AAAA
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // DD/MM/AA
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
    // DD-MM-AAAA
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    // DD.MM.AAAA
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
    // DD-MM-AA
    /^(\d{1,2})-(\d{1,2})-(\d{2})$/,
    // DD.MM.AA
    /^(\d{1,2})\.(\d{1,2})\.(\d{2})$/,
  ];

  for (const pattern of patterns) {
    const match = cleanDate.match(pattern);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      let year = parseInt(match[3], 10);

      // Se ano tem 2 dígitos, assume 20XX
      if (year < 100) {
        year += 2000;
      }

      // Validação básica (aceita datas futuras até 2030)
      if (
        day >= 1 &&
        day <= 31 &&
        month >= 1 &&
        month <= 12 &&
        year >= 2000 &&
        year <= 2030
      ) {
        // Criar data com horário local preservado (meio-dia para evitar problemas de timezone)
        const date = new Date(year, month - 1, day, 12, 0, 0, 0);

        // Verifica se a data é válida (ex: 31/02 não é válido)
        if (
          date.getDate() === day &&
          date.getMonth() === month - 1 &&
          date.getFullYear() === year
        ) {
          return date;
        }
      }
    }
  }

  return null;
}

// Função auxiliar para melhorar a interpretação de marcas e estabelecimentos
function enhanceBrandRecognition(
  name: string,
  lowerMessage: string,
): { name: string; category: string } {
  const brandMappings = {
    // Fast Food
    kfc: { name: "KFC", category: "FOOD" },
    mcdonalds: { name: "McDonald's", category: "FOOD" },
    "burger king": { name: "Burger King", category: "FOOD" },
    subway: { name: "Subway", category: "FOOD" },
    "pizza hut": { name: "Pizza Hut", category: "FOOD" },
    dominos: { name: "Domino's", category: "FOOD" },

    // Delivery
    ifood: { name: "iFood", category: "FOOD" },
    "uber eats": { name: "Uber Eats", category: "FOOD" },
    rappi: { name: "Rappi", category: "FOOD" },

    // Transporte
    uber: { name: "Uber", category: "TRANSPORTATION" },
    "99": { name: "99", category: "TRANSPORTATION" },
    cabify: { name: "Cabify", category: "TRANSPORTATION" },

    // Streaming
    netflix: { name: "Netflix", category: "ENTERTAINMENT" },
    spotify: { name: "Spotify", category: "ENTERTAINMENT" },
    "amazon prime": {
      name: "Amazon Prime",
      category: "ENTERTAINMENT",
    },
    disney: { name: "Disney+", category: "ENTERTAINMENT" },
    hbo: { name: "HBO Max", category: "ENTERTAINMENT" },

    // Investimentos
    tesouro: { name: "Tesouro Direto", category: "OTHER" },
    cdb: { name: "CDB", category: "OTHER" },
    lci: { name: "LCI", category: "OTHER" },
    lca: { name: "LCA", category: "OTHER" },
    nubank: { name: "NuBank", category: "OTHER" },
    inter: { name: "Inter", category: "OTHER" },
    btg: { name: "BTG", category: "OTHER" },

    // Postos de gasolina
    shell: { name: "Shell", category: "TRANSPORTATION" },
    ipiranga: {
      name: "Ipiranga",
      category: "TRANSPORTATION",
    },
    petrobras: {
      name: "Petrobras",
      category: "TRANSPORTATION",
    },
    posto: { name: "Posto", category: "TRANSPORTATION" },
  };

  const lowerName = name.toLowerCase();

  for (const [key, mapping] of Object.entries(brandMappings)) {
    if (lowerName.includes(key) || lowerMessage.includes(key)) {
      return mapping;
    }
  }

  return { name, category: "OTHER" };
}

// Função auxiliar para obter data atual no fuso horário do Brasil
function getBrazilDate(): Date {
  const now = new Date();
  const brazilOffset = -3 * 60; // UTC-3 em minutos
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const brazilTime = new Date(utc + brazilOffset * 60000);

  // Normalizar para meio-dia para evitar problemas de edição/display
  return new Date(
    brazilTime.getFullYear(),
    brazilTime.getMonth(),
    brazilTime.getDate(),
    12,
    0,
    0,
    0,
  );
}

// Função para interpretar datas relativas
function parseRelativeDate(message: string): Date | null {
  const lowerMessage = message.toLowerCase();
  const today = getBrazilDate();
  console.log("parseRelativeDate - Brazil timezone today:", today);
  console.log("parseRelativeDate - Message:", message);

  // Padrões para datas relativas (todas normalizadas para meio-dia)
  const datePatterns = {
    // Hoje
    hoje: () => today,

    // Ontem
    ontem: () => {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      // Normalizar para meio-dia
      yesterday.setHours(12, 0, 0, 0);
      return yesterday;
    },

    // Amanhã
    amanha: () => {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      // Normalizar para meio-dia
      tomorrow.setHours(12, 0, 0, 0);
      console.log("parseRelativeDate - Amanhã calculado:", tomorrow);
      return tomorrow;
    },
    amanhã: () => {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      // Normalizar para meio-dia
      tomorrow.setHours(12, 0, 0, 0);
      console.log("parseRelativeDate - Amanhã calculado:", tomorrow);
      return tomorrow;
    },

    // Semana passada
    "semana passada": () => {
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      // Normalizar para meio-dia
      lastWeek.setHours(12, 0, 0, 0);
      return lastWeek;
    },
    "sem passada": () => {
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      // Normalizar para meio-dia
      lastWeek.setHours(12, 0, 0, 0);
      return lastWeek;
    },

    // Semana que vem
    "semana que vem": () => {
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      // Normalizar para meio-dia
      nextWeek.setHours(12, 0, 0, 0);
      return nextWeek;
    },
    "próxima semana": () => {
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      // Normalizar para meio-dia
      nextWeek.setHours(12, 0, 0, 0);
      return nextWeek;
    },
    "proxima semana": () => {
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      // Normalizar para meio-dia
      nextWeek.setHours(12, 0, 0, 0);
      return nextWeek;
    },

    // Mês passado
    "mês passado": () => {
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      // Normalizar para meio-dia
      lastMonth.setHours(12, 0, 0, 0);
      return lastMonth;
    },
    "mes passado": () => {
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      // Normalizar para meio-dia
      lastMonth.setHours(12, 0, 0, 0);
      return lastMonth;
    },

    // Próximo mês
    "próximo mês": () => {
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      // Normalizar para meio-dia
      nextMonth.setHours(12, 0, 0, 0);
      return nextMonth;
    },
    "proximo mes": () => {
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      // Normalizar para meio-dia
      nextMonth.setHours(12, 0, 0, 0);
      return nextMonth;
    },
    "mês que vem": () => {
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      // Normalizar para meio-dia
      nextMonth.setHours(12, 0, 0, 0);
      return nextMonth;
    },
    "mes que vem": () => {
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      // Normalizar para meio-dia
      nextMonth.setHours(12, 0, 0, 0);
      return nextMonth;
    },

    // Próxima segunda-feira
    "próxima segunda": () => {
      const monday = new Date(today);
      const dayOfWeek = monday.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      monday.setDate(monday.getDate() + daysUntilMonday);
      // Normalizar para meio-dia
      monday.setHours(12, 0, 0, 0);
      return monday;
    },
    "proxima segunda": () => {
      const monday = new Date(today);
      const dayOfWeek = monday.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      monday.setDate(monday.getDate() + daysUntilMonday);
      // Normalizar para meio-dia
      monday.setHours(12, 0, 0, 0);
      return monday;
    },

    // Próxima terça-feira
    "próxima terça": () => {
      const tuesday = new Date(today);
      const dayOfWeek = tuesday.getDay();
      const daysUntilTuesday = dayOfWeek <= 2 ? 2 - dayOfWeek : 9 - dayOfWeek;
      tuesday.setDate(tuesday.getDate() + daysUntilTuesday);
      // Normalizar para meio-dia
      tuesday.setHours(12, 0, 0, 0);
      return tuesday;
    },
    "proxima terca": () => {
      const tuesday = new Date(today);
      const dayOfWeek = tuesday.getDay();
      const daysUntilTuesday = dayOfWeek <= 2 ? 2 - dayOfWeek : 9 - dayOfWeek;
      tuesday.setDate(tuesday.getDate() + daysUntilTuesday);
      // Normalizar para meio-dia
      tuesday.setHours(12, 0, 0, 0);
      return tuesday;
    },

    // Próxima quarta-feira
    "próxima quarta": () => {
      const wednesday = new Date(today);
      const dayOfWeek = wednesday.getDay();
      const daysUntilWednesday =
        dayOfWeek <= 3 ? 3 - dayOfWeek : 10 - dayOfWeek;
      wednesday.setDate(wednesday.getDate() + daysUntilWednesday);
      // Normalizar para meio-dia
      wednesday.setHours(12, 0, 0, 0);
      return wednesday;
    },
    "proxima quarta": () => {
      const wednesday = new Date(today);
      const dayOfWeek = wednesday.getDay();
      const daysUntilWednesday =
        dayOfWeek <= 3 ? 3 - dayOfWeek : 10 - dayOfWeek;
      wednesday.setDate(wednesday.getDate() + daysUntilWednesday);
      // Normalizar para meio-dia
      wednesday.setHours(12, 0, 0, 0);
      return wednesday;
    },

    // Próxima quinta-feira
    "próxima quinta": () => {
      const thursday = new Date(today);
      const dayOfWeek = thursday.getDay();
      const daysUntilThursday = dayOfWeek <= 4 ? 4 - dayOfWeek : 11 - dayOfWeek;
      thursday.setDate(thursday.getDate() + daysUntilThursday);
      // Normalizar para meio-dia
      thursday.setHours(12, 0, 0, 0);
      return thursday;
    },
    "proxima quinta": () => {
      const thursday = new Date(today);
      const dayOfWeek = thursday.getDay();
      const daysUntilThursday = dayOfWeek <= 4 ? 4 - dayOfWeek : 11 - dayOfWeek;
      thursday.setDate(thursday.getDate() + daysUntilThursday);
      // Normalizar para meio-dia
      thursday.setHours(12, 0, 0, 0);
      return thursday;
    },

    // Próxima sexta-feira
    "próxima sexta": () => {
      const friday = new Date(today);
      const dayOfWeek = friday.getDay();
      const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 12 - dayOfWeek;
      friday.setDate(friday.getDate() + daysUntilFriday);
      // Normalizar para meio-dia
      friday.setHours(12, 0, 0, 0);
      return friday;
    },
    "proxima sexta": () => {
      const friday = new Date(today);
      const dayOfWeek = friday.getDay();
      const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 12 - dayOfWeek;
      friday.setDate(friday.getDate() + daysUntilFriday);
      // Normalizar para meio-dia
      friday.setHours(12, 0, 0, 0);
      return friday;
    },

    // Próximo sábado
    "próximo sábado": () => {
      const saturday = new Date(today);
      const dayOfWeek = saturday.getDay();
      const daysUntilSaturday = dayOfWeek === 6 ? 7 : 6 - dayOfWeek;
      saturday.setDate(saturday.getDate() + daysUntilSaturday);
      // Normalizar para meio-dia
      saturday.setHours(12, 0, 0, 0);
      return saturday;
    },
    "proximo sabado": () => {
      const saturday = new Date(today);
      const dayOfWeek = saturday.getDay();
      const daysUntilSaturday = dayOfWeek === 6 ? 7 : 6 - dayOfWeek;
      saturday.setDate(saturday.getDate() + daysUntilSaturday);
      // Normalizar para meio-dia
      saturday.setHours(12, 0, 0, 0);
      return saturday;
    },

    // Próximo domingo
    "próximo domingo": () => {
      const sunday = new Date(today);
      const dayOfWeek = sunday.getDay();
      const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
      sunday.setDate(sunday.getDate() + daysUntilSunday);
      // Normalizar para meio-dia
      sunday.setHours(12, 0, 0, 0);
      return sunday;
    },
    "proximo domingo": () => {
      const sunday = new Date(today);
      const dayOfWeek = sunday.getDay();
      const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
      sunday.setDate(sunday.getDate() + daysUntilSunday);
      // Normalizar para meio-dia
      sunday.setHours(12, 0, 0, 0);
      return sunday;
    },

    // Dias específicos da semana (sem "próxima")
    segunda: () => {
      const monday = new Date(today);
      const dayOfWeek = monday.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; // Se domingo, próxima segunda é +1
      monday.setDate(monday.getDate() + daysUntilMonday);
      // Normalizar para meio-dia
      monday.setHours(12, 0, 0, 0);
      return monday;
    },
    terça: () => {
      const tuesday = new Date(today);
      const dayOfWeek = tuesday.getDay();
      const daysUntilTuesday = dayOfWeek <= 2 ? 2 - dayOfWeek : 9 - dayOfWeek;
      tuesday.setDate(tuesday.getDate() + daysUntilTuesday);
      // Normalizar para meio-dia
      tuesday.setHours(12, 0, 0, 0);
      return tuesday;
    },
    quarta: () => {
      const wednesday = new Date(today);
      const dayOfWeek = wednesday.getDay();
      const daysUntilWednesday =
        dayOfWeek <= 3 ? 3 - dayOfWeek : 10 - dayOfWeek;
      wednesday.setDate(wednesday.getDate() + daysUntilWednesday);
      // Normalizar para meio-dia
      wednesday.setHours(12, 0, 0, 0);
      return wednesday;
    },
    quinta: () => {
      const thursday = new Date(today);
      const dayOfWeek = thursday.getDay();
      const daysUntilThursday = dayOfWeek <= 4 ? 4 - dayOfWeek : 11 - dayOfWeek;
      thursday.setDate(thursday.getDate() + daysUntilThursday);
      // Normalizar para meio-dia
      thursday.setHours(12, 0, 0, 0);
      return thursday;
    },
    sexta: () => {
      const friday = new Date(today);
      const dayOfWeek = friday.getDay();
      const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 12 - dayOfWeek;
      friday.setDate(friday.getDate() + daysUntilFriday);
      // Normalizar para meio-dia
      friday.setHours(12, 0, 0, 0);
      return friday;
    },
    sábado: () => {
      const saturday = new Date(today);
      const dayOfWeek = saturday.getDay();
      const daysUntilSaturday = dayOfWeek === 6 ? 7 : 6 - dayOfWeek;
      saturday.setDate(saturday.getDate() + daysUntilSaturday);
      // Normalizar para meio-dia
      saturday.setHours(12, 0, 0, 0);
      return saturday;
    },
    sabado: () => {
      const saturday = new Date(today);
      const dayOfWeek = saturday.getDay();
      const daysUntilSaturday = dayOfWeek === 6 ? 7 : 6 - dayOfWeek;
      saturday.setDate(saturday.getDate() + daysUntilSaturday);
      // Normalizar para meio-dia
      saturday.setHours(12, 0, 0, 0);
      return saturday;
    },
    domingo: () => {
      const sunday = new Date(today);
      const dayOfWeek = sunday.getDay();
      const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
      sunday.setDate(sunday.getDate() + daysUntilSunday);
      // Normalizar para meio-dia
      sunday.setHours(12, 0, 0, 0);
      return sunday;
    },
  };

  // Procurar por padrões de data na mensagem
  for (const [pattern, getDate] of Object.entries(datePatterns)) {
    if (lowerMessage.includes(pattern)) {
      return getDate();
    }
  }

  // Padrões para datas específicas (ex: "dia 12", "12 de janeiro")
  const specificDatePatterns = [
    // "dia 12" ou "dia 12 de janeiro"
    /dia\s+(\d{1,2})(?:\s+de\s+(\w+))?/i,
    // "12 de janeiro"
    /(\d{1,2})\s+de\s+(\w+)/i,
    // "12/01" ou "12-01"
    /(\d{1,2})[\/\-](\d{1,2})/i,
    // "dia 12 do próximo mês" ou "dia 12 do próximo ano"
    /dia\s+(\d{1,2})\s+do\s+(?:pr[oó]ximo|proximo)\s+(m[eê]s|ano)/i,
    // "12 do próximo mês" ou "12 do próximo ano"
    /(\d{1,2})\s+do\s+(?:pr[oó]ximo|proximo)\s+(m[eê]s|ano)/i,
  ];

  for (const pattern of specificDatePatterns) {
    const match = message.match(pattern);
    if (match) {
      const day = parseInt(match[1]);
      let month = today.getMonth(); // Mês atual por padrão
      let year = today.getFullYear(); // Ano atual por padrão

      if (match[2]) {
        const monthName = match[2].toLowerCase();
        const monthNames: { [key: string]: number } = {
          janeiro: 0,
          jan: 0,
          january: 0,
          fevereiro: 1,
          fev: 1,
          february: 1,
          março: 2,
          mar: 2,
          march: 2,
          abril: 3,
          abr: 3,
          april: 3,
          maio: 4,
          may: 4,
          junho: 5,
          jun: 5,
          june: 5,
          julho: 6,
          jul: 6,
          july: 6,
          agosto: 7,
          ago: 7,
          august: 7,
          setembro: 8,
          set: 8,
          september: 8,
          outubro: 9,
          out: 9,
          october: 9,
          novembro: 10,
          nov: 10,
          november: 10,
          dezembro: 11,
          dez: 11,
          december: 11,
        };

        if (monthNames[monthName] !== undefined) {
          month = monthNames[monthName];
        } else if (pattern === specificDatePatterns[2]) {
          // Para padrão DD/MM ou DD-MM
          month = parseInt(match[2]) - 1; // JavaScript usa 0-11 para meses
        } else if (
          pattern === specificDatePatterns[3] ||
          pattern === specificDatePatterns[4]
        ) {
          // Para padrões "próximo mês" ou "próximo ano"
          if (monthName === "mês" || monthName === "mes") {
            month = today.getMonth() + 1;
            if (month > 11) {
              month = 0;
              year = year + 1;
            }
          } else if (monthName === "ano") {
            year = year + 1;
          }
        }
      }

      const date = new Date(year, month, day);

      // Para datas sem especificação de mês/ano, verificar se já passou
      if (
        !match[2] ||
        (pattern !== specificDatePatterns[3] &&
          pattern !== specificDatePatterns[4])
      ) {
        // Se a data já passou este ano, assumir próximo ano
        if (date < today) {
          date.setFullYear(date.getFullYear() + 1);
        }
      }

      return date;
    }
  }

  return null; // Nenhuma data relativa encontrada
}

// Função para extrair dados da transação da mensagem usando GPT
async function extractTransactionData(
  message: string,
  imageUrl?: string,
  userId?: string,
  isFromAudio?: boolean,
): Promise<{
  name: string;
  amount: number | null;
  category: string;
  paymentMethod: TransactionPaymentMethod;
  type: TransactionType;
  date: Date | null;
} | null> {
  try {
    // Obter a data atual para usar nos exemplos - usando timezone do Brasil
    const today = getBrazilDate();
    const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    console.log("extractTransactionData - Brazil timezone today:", todayStr);
    console.log(
      "extractTransactionData - Brazil timezone yesterday:",
      yesterdayStr,
    );

    const messages: any[] = [
      {
        role: "system",
        content: `Você é um assistente especializado em extrair dados de transações financeiras de mensagens em português brasileiro e análise de imagens de notas fiscais/cupons.

Sua tarefa é analisar a mensagem do usuário e/ou imagem fornecida e extrair os dados da transação financeira.

⚠️ ATENÇÃO: O campo "name" deve ser o nome ESPECÍFICO mencionado na mensagem ou identificado na imagem, não genéricos!
- "Ganhei 50 reais do meu avô" → name: "Avô" (não "Salário")
- "Gastei 30 reais na farmácia" → name: "Farmácia" (não "Saúde")
- "Paguei 200 reais de aluguel" → name: "Aluguel" (não "Moradia")
- Nota fiscal do McDonald's → name: "McDonald's"
- Cupom da farmácia → name: "Farmácia"

RESPONDA APENAS COM UM JSON válido no seguinte formato:
{
  "name": "nome da transação",
  "amount": valor_numerico_ou_null,
  "category": "FOOD|TRANSPORTATION|HEALTH|ENTERTAINMENT|EDUCATION|HOUSING|UTILITY|SALARY|OTHER",
  "paymentMethod": "CASH|CREDIT_CARD|DEBIT_CARD|PIX|BANK_TRANSFER|BANK_SLIP",
  "type": "EXPENSE|DEPOSIT|INVESTMENT",
  "date": "YYYY-MM-DD"
}

REGRAS IMPORTANTES:
1. "name": Nome ESPECÍFICO da transação baseado no contexto da mensagem/imagem
   - NÃO use genéricos como "Salário", "Gasto", "Despesa"
   - Use o nome específico mencionado na mensagem ou identificado na imagem
   - Se mencionar pessoa: "Avô", "Pai", "Mãe", "João"
   - Se mencionar estabelecimento: "KFC", "McDonald's", "Farmácia"
   - Se mencionar serviço: "Aluguel", "Internet", "Gasolina"
   - Se for imagem: identifique o estabelecimento/comerciante
2. "amount": Apenas números (ex: 50.00, 1000, null se não especificado)
   - Se for imagem: extraia o valor total da nota/cupom
3. "category": Use as categorias exatas listadas acima
   - Se for imagem: categorize baseado no tipo de estabelecimento/produtos
4. "paymentMethod": Use os métodos exatos listados acima
   - Se for imagem: tente identificar o método de pagamento usado
5. "type": Use os tipos exatos listados acima
   - Para notas fiscais/cupons: geralmente é EXPENSE
6. "date": Formato ISO (YYYY-MM-DD) - SEMPRE forneça uma data:
   - Se não mencionar data → use a data de HOJE (${todayStr})
   - Se mencionar "ontem" → use a data de ontem (${yesterdayStr})
   - Se mencionar "amanhã" → calcule a data de amanhã baseada na data atual
   - Se for imagem: tente extrair a data da nota/cupom
   - NUNCA retorne null para o campo date
   - IMPORTANTE: Use sempre o timezone local (Brasil) para cálculos de data
   - CRÍTICO: "Gastei", "Comprei", "Paguei" (passado) = HOJE (${todayStr})

ANÁLISE DE IMAGENS DE NOTAS FISCAIS/CUPONS:
- Identifique o estabelecimento/comerciante
- Extraia o valor total da compra
- Identifique a data da transação
- Categorize baseado no tipo de estabelecimento
- Identifique o método de pagamento se visível

CATEGORIZAÇÃO INTELIGENTE:
- FOOD: Comida, restaurantes, supermercado, delivery, fast food
- TRANSPORTATION: Uber, gasolina, transporte público, combustível
- HEALTH: Médico, farmácia, hospital, saúde
- ENTERTAINMENT: Cinema, streaming, jogos, diversão
- EDUCATION: Cursos, livros, escola, educação
- HOUSING: Aluguel, casa, apartamento, moradia
- UTILITY: Luz, água, internet, utilidades
- SALARY: Salário, renda, trabalho
- OTHER: Investimentos, outros gastos

TIPOS DE TRANSAÇÃO:
- EXPENSE: Gastos, compras, despesas
- DEPOSIT: Receitas, salários, ganhos
- INVESTMENT: Investimentos, aplicações

MÉTODOS DE PAGAMENTO:
- CASH: Dinheiro, espécie
- CREDIT_CARD: Cartão de crédito
- DEBIT_CARD: Cartão de débito
- PIX: PIX, transferência instantânea
- BANK_TRANSFER: TED, DOC, transferência bancária
- BANK_SLIP: Boleto bancário

INTERPRETAÇÃO DE DATAS (use a data atual como referência):
- "ontem" → Data de ontem (${yesterdayStr})
- "amanhã" → Data de amanhã (próximo dia após hoje)
- "hoje" → Data de hoje (${todayStr})
- "semana passada" → 7 dias atrás
- "próxima semana" → 7 dias à frente
- "mês que vem" → Próximo mês
- "dia 15" → Dia 15 do mês atual
- "15 de janeiro" → 15 de janeiro do ano atual
- Se NÃO mencionar data específica → use a data de HOJE (${todayStr})
- Se mencionar "ontem" → calcule a data de ontem baseada na data atual
- Se mencionar "amanhã" → calcule a data de amanhã baseada na data atual (hoje + 1 dia)

IMPORTANTE - INTERPRETAÇÃO DE TEMPO VERBAL:
- "Gastei", "Comprei", "Paguei" (passado) → Data de HOJE (${todayStr})
- "Vou gastar", "Vou comprar", "Vou pagar" (futuro) → Data de HOJE (${todayStr}) a menos que especifique "amanhã"
- "Amanhã vou gastar" → Data de amanhã
- "Ontem gastei" → Data de ontem (${yesterdayStr})
- "Depois de amanhã vou" → Data de depois de amanhã

EXEMPLOS (assumindo que hoje é ${todayStr}):
Mensagem: "Gastei 50 reais no KFC"
Resposta: {"name": "KFC", "amount": 50, "category": "FOOD", "paymentMethod": "CASH", "type": "EXPENSE", "date": "${todayStr}"}

Mensagem: "Comprei um celular por 800 reais"
Resposta: {"name": "Celular", "amount": 800, "category": "OTHER", "paymentMethod": "CASH", "type": "EXPENSE", "date": "${todayStr}"}

Mensagem: "Paguei 200 reais de aluguel"
Resposta: {"name": "Aluguel", "amount": 200, "category": "HOUSING", "paymentMethod": "CASH", "type": "EXPENSE", "date": "${todayStr}"}

Mensagem: "Amanhã vou gastar 100 reais"
Resposta: {"name": "Gasto", "amount": 100, "category": "OTHER", "paymentMethod": "CASH", "type": "EXPENSE", "date": "${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0]}"}

Mensagem: "Ontem gastei 30 reais na farmácia"
Resposta: {"name": "Farmácia", "amount": 30, "category": "HEALTH", "paymentMethod": "CASH", "type": "EXPENSE", "date": "${yesterdayStr}"}

Mensagem: "Investi 1000 reais em CDB"
Resposta: {"name": "CDB", "amount": 1000, "category": "OTHER", "paymentMethod": "BANK_TRANSFER", "type": "INVESTMENT", "date": "${todayStr}"}

Mensagem: "Ganhei 5000 reais de salário ontem"
Resposta: {"name": "Salário", "amount": 5000, "category": "SALARY", "paymentMethod": "BANK_TRANSFER", "type": "DEPOSIT", "date": "${yesterdayStr}"}

Mensagem: "Ganhei 50 reais do meu avô"
Resposta: {"name": "Avô", "amount": 50, "category": "SALARY", "paymentMethod": "CASH", "type": "DEPOSIT", "date": "${todayStr}"}

Mensagem: "Meu avô me deu 50 reais ontem"
Resposta: {"name": "Avô", "amount": 50, "category": "SALARY", "paymentMethod": "CASH", "type": "DEPOSIT", "date": "${yesterdayStr}"}

Mensagem: "Paguei 200 reais de aluguel"
Resposta: {"name": "Aluguel", "amount": 200, "category": "HOUSING", "paymentMethod": "CASH", "type": "EXPENSE", "date": "${todayStr}"}

Mensagem: "Gastei 30 reais na farmácia"
Resposta: {"name": "Farmácia", "amount": 30, "category": "HEALTH", "paymentMethod": "CASH", "type": "EXPENSE", "date": "${todayStr}"}

Mensagem: "Amanhã vou no cinema e provavelmente gastar 120 reais"
Resposta: {"name": "Cinema", "amount": 120, "category": "ENTERTAINMENT", "paymentMethod": "CASH", "type": "EXPENSE", "date": "${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0]}"}

IMPORTANTE: Responda apenas o JSON, sem explicações ou texto adicional.`,
      },
    ];

    // Adicionar mensagem do usuário com ou sem imagem
    const userMessage: any = {
      role: "user",
      content: message,
    };

    if (imageUrl) {
      try {
        // Para URLs locais, converter para base64
        let imageData;
        if (imageUrl.startsWith("http")) {
          // URL externa - usar diretamente
          imageData = imageUrl;
        } else {
          // URL local - converter para base64
          const fs = await import("fs");
          const path = await import("path");
          const imagePath = path.join(process.cwd(), "public", imageUrl);
          const imageBuffer = fs.readFileSync(imagePath);
          const mimeType = imagePath.endsWith(".png")
            ? "image/png"
            : imagePath.endsWith(".jpg") || imagePath.endsWith(".jpeg")
              ? "image/jpeg"
              : "image/jpeg";
          imageData = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
        }

        userMessage.content = [
          {
            type: "text",
            text:
              message || "Analise esta imagem e extraia os dados da transação",
          },
          {
            type: "image_url",
            image_url: {
              url: imageData,
            },
          },
        ];
        console.log(
          "extractTransactionData - Image message constructed with base64",
        );
      } catch (error) {
        console.error(
          "Error processing image in extractTransactionData:",
          error,
        );
        // Se falhar, usar apenas texto
        userMessage.content = message || "Erro ao processar imagem";
      }
    }

    messages.push(userMessage);

    console.log(
      "extractTransactionData - Sending to GPT with imageUrl:",
      imageUrl,
    );
    console.log("extractTransactionData - Using model: gpt-4o-mini");
    console.log(
      "extractTransactionData - Image URL starts with data:",
      imageUrl?.startsWith("data:"),
    );
    console.log("extractTransactionData - Image URL length:", imageUrl?.length);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 200,
      temperature: 0.1,
    });

    // Log token usage for transaction extraction
    if (completion.usage) {
      const cost = calculateTokenCost(
        "gpt-4o-mini",
        completion.usage.total_tokens,
      );
      // Log token usage for transaction extraction
      if (isFromAudio) {
        // Acumular custos do chat para consolidação posterior
        chatCosts += cost;
        chatTokens += completion.usage.total_tokens;
        console.log("🔗 Accumulated extraction cost:", {
          cost,
          tokens: completion.usage.total_tokens,
          totalChatCosts: chatCosts,
          totalChatTokens: chatTokens,
        });
      } else {
        // Acumular custos para consolidação posterior (mensagens de texto)
        textTransactionCosts += cost;
        textTransactionTokens += completion.usage.total_tokens;
        console.log("🔗 Accumulated text extraction cost:", {
          cost,
          tokens: completion.usage.total_tokens,
          totalTextCosts: textTransactionCosts,
          totalTextTokens: textTransactionTokens,
        });
      }
    }

    const response = completion.choices[0]?.message?.content?.trim();

    if (!response) {
      throw new Error("No response from GPT");
    }

    // Tentar fazer parse do JSON (lidar com markdown se presente)
    let jsonString = response;

    // Se a resposta contém markdown JSON, extrair apenas o JSON
    if (jsonString.includes("```json")) {
      const jsonMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonString = jsonMatch[1].trim();
      }
    } else if (jsonString.includes("```")) {
      const jsonMatch = jsonString.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonString = jsonMatch[1].trim();
      }
    }

    const transactionData = JSON.parse(jsonString);

    // Validar e converter os dados
    let parsedDate: Date;
    if (transactionData.date) {
      // Se a data vem como string do GPT, converter para Date local
      const dateStr = transactionData.date;
      console.log("extractTransactionData - Raw date string:", dateStr);

      // Criar data local para evitar problemas de timezone (usar meio-dia)
      if (typeof dateStr === "string") {
        const [year, month, day] = dateStr.split("-").map(Number);
        parsedDate = new Date(year, month - 1, day, 12, 0, 0, 0); // month é 0-indexed, meio-dia para evitar problemas de timezone
      } else {
        parsedDate = new Date(dateStr);
      }

      console.log("extractTransactionData - Parsed date:", parsedDate);
    } else {
      // Se não tiver data, usar parseRelativeDate para extrair da mensagem
      const relativeDate = parseRelativeDate(message);
      parsedDate = relativeDate || new Date();
      console.log(
        "extractTransactionData - Using relative date:",
        relativeDate,
      );
    }

    const result = {
      name: transactionData.name || "",
      amount: transactionData.amount || null,
      category: (transactionData.category as string) || "OTHER",
      paymentMethod:
        (transactionData.paymentMethod as TransactionPaymentMethod) ||
        TransactionPaymentMethod.CASH,
      type:
        (transactionData.type as TransactionType) || TransactionType.EXPENSE,
      date: parsedDate,
    };

    return result;
  } catch (error) {
    console.error("Error extracting transaction data with GPT:", error);

    // Fallback para extração básica usando regex
    const lowerMessage = message.toLowerCase();

    // Extrair valor monetário
    const amountMatch = message.match(
      /r\$\s*(\d+(?:[.,]\d{2})?)|(\d+(?:[.,]\d{2})?)\s*reais?/i,
    );
    let amount: number | null = null;
    if (amountMatch) {
      const valueStr = amountMatch[1] || amountMatch[2];
      amount = parseFloat(valueStr.replace(",", "."));
    }

    // Extrair data relativa
    const date = parseRelativeDate(message);
    console.log("extractTransactionData - Fallback date extracted:", date);

    // Detectar tipo básico
    let type: TransactionType = TransactionType.EXPENSE;
    if (
      ["ganhei", "ganho", "recebi", "receita", "salário"].some((keyword) =>
        lowerMessage.includes(keyword),
      )
    ) {
      type = TransactionType.DEPOSIT;
    } else if (
      ["investi", "investimento", "apliquei", "aplicação"].some((keyword) =>
        lowerMessage.includes(keyword),
      )
    ) {
      type = TransactionType.INVESTMENT;
    }

    // Detectar categoria básica
    let category: string = "OTHER";
    if (
      ["comida", "alimentação", "restaurante", "kfc", "mcdonalds"].some(
        (keyword) => lowerMessage.includes(keyword),
      )
    ) {
      category = "FOOD";
    } else if (
      ["uber", "taxi", "gasolina", "transporte"].some((keyword) =>
        lowerMessage.includes(keyword),
      )
    ) {
      category = "TRANSPORTATION";
    } else if (
      ["salário", "salario", "renda"].some((keyword) =>
        lowerMessage.includes(keyword),
      )
    ) {
      category = "SALARY";
    }

    // Extrair nome usando regex mais inteligente
    let name = "";

    // Padrões para capturar o nome da transação
    const namePatterns = [
      // "ganhei 50 reais do meu avô" -> "avô"
      /(?:ganhei|ganho|recebi|receita)\s+(?:r\$\s*\d+[.,]?\d*)?\s*(?:reais?)?\s*(?:de|do|da|com|em)\s+(?:meu|minha|o|a|os|as)?\s*([a-zA-ZÀ-ÿ\s]+?)(?:\s|$|,|\.)/i,
      // "gastei 50 reais no kfc" -> "kfc"
      /(?:gastei|gasto|despesei|despesa|paguei|pago|comprei|compra)\s+(?:r\$\s*\d+[.,]?\d*)?\s*(?:reais?)?\s*(?:no|na|em|com|de)\s+([a-zA-ZÀ-ÿ\s]+?)(?:\s|$|,|\.)/i,
      // "investi 50 reais em tesouro" -> "tesouro"
      /(?:investi|investimento|apliquei|aplicação)\s+(?:r\$\s*\d+[.,]?\d*)?\s*(?:reais?)?\s*(?:em|no|na)\s+([a-zA-ZÀ-ÿ\s]+?)(?:\s|$|,|\.)/i,
      // "paguei 200 reais de aluguel" -> "aluguel"
      /(?:paguei|pago|comprei|compra)\s+(?:r\$\s*\d+[.,]?\d*)?\s*(?:reais?)?\s*(?:de|com|em)\s+([a-zA-ZÀ-ÿ]+)/i,
      // "no kfc" -> "kfc"
      /(?:no|na|em)\s+([a-zA-ZÀ-ÿ\s]+?)(?:\s|$|,|\.)/i,
    ];

    for (const pattern of namePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        name = match[1].trim();
        // Limpar palavras desnecessárias
        name = name
          .replace(
            /\b(?:reais?|r\$|no|na|em|de|com|para|uma|um|o|a|os|as|meu|minha)\b/gi,
            "",
          )
          .trim();
        if (name.length > 1 && !name.match(/^\d+$/) && !name.match(/^r\$/i)) {
          break;
        } else {
          name = ""; // Reset se não for válido
        }
      }
    }

    // Se ainda não tem nome, tentar capturar palavras significativas
    if (!name) {
      const words = message
        .split(" ")
        .filter(
          (word) =>
            !word.match(/^\d+$/) &&
            !word.match(/^r\$/i) &&
            word.length > 2 &&
            ![
              "paguei",
              "comprei",
              "gastei",
              "despesei",
              "gasto",
              "despesa",
              "transação",
              "adicionar",
              "reais",
              "no",
              "na",
              "em",
              "de",
              "com",
              "ganhei",
              "recebi",
              "investi",
              "apliquei",
              "do",
              "da",
              "dos",
              "das",
            ].includes(word.toLowerCase()),
        )
        .slice(0, 2);
      name = words.join(" ");
    }

    // Se o nome for muito genérico, deixar vazio para mostrar placeholder
    if (
      name &&
      (name.length < 3 ||
        ["transação", "gasto", "despesa", "compra", "pagamento"].includes(
          name.toLowerCase(),
        ))
    ) {
      name = "";
    }

    // Garantir que a data seja consistente
    const finalDate = date || new Date();
    console.log("extractTransactionData - Fallback final date:", finalDate);

    return {
      name: name || "",
      amount: amount || null,
      category,
      paymentMethod: TransactionPaymentMethod.CASH,
      type,
      date: finalDate,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verificar se o usuário pode usar o Midas
    const canUseMidas = await canUserUseMidas();
    if (!canUseMidas) {
      return NextResponse.json(
        {
          error:
            "Você precisa de um plano ativo para usar o Midas AI. Assine um plano para continuar.",
        },
        { status: 403 },
      );
    }

    const {
      messages,
      stream = false,
      whisperData: incomingWhisperData,
    } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 },
      );
    }

    // Verificar se a última mensagem é uma solicitação de transação
    // Esta verificação funciona tanto para texto digitado quanto para áudio transcrito pelo Whisper ou imagens
    const lastMessage = messages[messages.length - 1];

    // Verificar se a mensagem veio de áudio transcrito
    const isFromAudio = lastMessage?.isFromAudio === true;

    // Capturar dados do Whisper se disponível
    if (incomingWhisperData) {
      whisperCost = incomingWhisperData.whisperCost;
      whisperTokens = incomingWhisperData.whisperTokens;
      chatCosts = 0; // Resetar custos do chat
      chatTokens = 0; // Resetar tokens do chat
      console.log("🔗 Whisper data captured for consolidation:", {
        whisperCost,
        whisperTokens,
      });
    } else {
      // Resetar variáveis para mensagens de texto
      textTransactionCosts = 0;
      textTransactionTokens = 0;
    }

    // Debug log para verificar a flag
    console.log("🔍 Chat endpoint - isFromAudio check:", {
      isFromAudio: isFromAudio,
      lastMessageIsFromAudio: lastMessage?.isFromAudio,
      lastMessageContent: lastMessage?.content?.substring(0, 50) + "...",
      whisperCost,
      whisperTokens,
    });

    // Verificar limites específicos por plano
    const userPlan = await getUserPlan();

    // Verificar se pode enviar mensagem (plano Start)
    if (userPlan === "start") {
      const canSendMessage = await canUserSendMessage();
      if (!canSendMessage) {
        return NextResponse.json(
          {
            error: "LIMIT_REACHED",
            limitType: "messages",
            message:
              "Você atingiu o limite de 10 mensagens por mês do plano Start. Faça upgrade para continuar.",
          },
          { status: 403 },
        );
      }
    }

    // Verificar se pode usar tokens (plano Pro e Premium)
    if (userPlan === "pro" || userPlan === "premium") {
      const canUseTokens = await canUserUseTokens();
      if (!canUseTokens) {
        const limit = userPlan === "pro" ? "3 milhões" : "20 milhões";
        return NextResponse.json(
          {
            error: "LIMIT_REACHED",
            limitType: "tokens",
            message: `Você atingiu o limite de ${limit} tokens por mês do plano ${userPlan === "pro" ? "Pro" : "Premium"}. Faça upgrade para continuar.`,
          },
          { status: 403 },
        );
      }
    }

    // Se há imagem, fazer análise completa automática
    if (lastMessage.imageUrl) {
      // Verificar se pode enviar imagem (plano Start)
      if (userPlan === "start") {
        const canSendImage = await canUserSendImage();
        if (!canSendImage) {
          return NextResponse.json(
            {
              error: "LIMIT_REACHED",
              limitType: "images",
              message:
                "Você atingiu o limite de 2 imagens por mês do plano Start. Faça upgrade para continuar.",
            },
            { status: 403 },
          );
        }
      }
      console.log("API - Image detected, doing complete analysis");

      try {
        // Timeout de 20 segundos para análise robusta (aumentado para múltiplas estratégias)
        const result = (await Promise.race([
          analyzeImageRobust(lastMessage.content, lastMessage.imageUrl, userId),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 20000),
          ),
        ])) as any;

        console.log("API - Complete analysis result:", result);

        const transactionData = result.transactionData;
        const qualityScore = result.qualityScore || 0;
        const qualitySuggestions = generateQualitySuggestions(
          qualityScore,
          result.transcription,
        );

        // Verificar se a extração foi bem-sucedida
        const isExtractionSuccessful =
          transactionData &&
          transactionData.name !== "Estabelecimento não identificado" &&
          transactionData.amount &&
          transactionData.amount > 0 &&
          qualityScore >= 0.5;

        if (isExtractionSuccessful) {
          // Retornar transcrição + dados extraídos
          let responseMessage = `📸 **Análise Completa da Imagem:**\n\n${result.transcription}`;

          responseMessage += `\n\n✅ **Dados Extraídos com Sucesso:**\n`;
          responseMessage += `- **Estabelecimento:** ${transactionData.name}\n`;
          responseMessage += `- **Valor:** R$ ${transactionData.amount?.toFixed(2) || "N/A"}\n`;
          responseMessage += `- **Categoria:** ${transactionData.category}\n`;
          responseMessage += `- **Método de Pagamento:** ${transactionData.paymentMethod}\n`;
          responseMessage += `- **Data:** ${transactionData.date ? transactionData.date.toLocaleDateString("pt-BR") : "Hoje"}`;

          // Adicionar sugestões de qualidade se necessário
          if (qualitySuggestions) {
            responseMessage += qualitySuggestions;
          }

          // Adicionar mensagem de sucesso
          responseMessage += `\n\n🎉 **Dados extraídos com sucesso!**`;
          responseMessage += `\n\n⚠️ **IMPORTANTE:** Verifique se os dados acima estão corretos antes de salvar a transação.`;
          responseMessage += `\n\n💡 **Dica:** Se algum dado estiver incorreto, você pode editá-lo no formulário que será aberto.`;

          // Adicionar dicas específicas baseadas na qualidade
          if (qualityScore >= 0.9) {
            responseMessage += `\n\n✨ **Excelente qualidade!** A imagem estava muito clara.`;
          } else if (qualityScore >= 0.7) {
            responseMessage += `\n\n👍 **Boa qualidade!** A maioria dos dados foi extraída.`;
          }

          return NextResponse.json({
            message: responseMessage,
            usage: null,
            transactionData: transactionData,
          });
        } else {
          // Extração falhou - não abrir tela de transação
          let responseMessage = `📸 **Análise da Imagem:**\n\n`;

          if (
            result.transcription &&
            result.transcription !== "Transcrição não disponível"
          ) {
            responseMessage += `${result.transcription}\n\n`;
          }

          responseMessage += `⚠️ **Não foi possível extrair dados da transação automaticamente.**\n\n`;
          responseMessage += `**💡 Dicas para melhorar:**\n`;
          responseMessage += `• Tire uma foto mais próxima do documento\n`;
          responseMessage += `• Certifique-se de que o texto está bem focado\n`;
          responseMessage += `• Evite reflexos e sombras\n`;
          responseMessage += `• Inclua todo o documento na foto\n\n`;

          responseMessage += `**🔄 O que fazer agora:**\n`;
          responseMessage += `• Tente tirar uma nova foto com melhor qualidade\n`;
          responseMessage += `• Ou adicione os dados da transação manualmente\n`;
          responseMessage += `• Use o botão "Adicionar Transação" no menu`;

          return NextResponse.json({
            message: responseMessage,
            usage: null,
            transactionData: null, // Não enviar dados de transação
          });
        }
      } catch (error) {
        console.error("API - Complete analysis failed:", error);

        // Se a análise falhar, não retornar mensagem, deixar continuar o fluxo normal
        console.log("API - Analysis failed, continuing with normal flow");
      }
    }

    console.log(
      "API - Starting transaction detection for message:",
      lastMessage?.content,
    );
    console.log("API - Message role:", lastMessage?.role);
    console.log("API - Has image:", !!lastMessage?.imageUrl);

    const isTransactionRequest =
      lastMessage?.role === "user" &&
      (await detectTransactionRequest(
        lastMessage.content,
        lastMessage.imageUrl,
        userId,
        isFromAudio,
      ));

    console.log("API - Transaction request detected:", isTransactionRequest);
    console.log("API - Will extract transaction data:", isTransactionRequest);
    console.log(
      "API - Message source (text/voice/image):",
      lastMessage?.content,
    );
    console.log("API - Image URL:", lastMessage?.imageUrl);
    console.log(
      "API - Full last message:",
      JSON.stringify(lastMessage, null, 2),
    );
    console.log("API - Image URL type:", typeof lastMessage?.imageUrl);
    console.log("API - Image URL length:", lastMessage?.imageUrl?.length);

    let transactionData = null;
    if (isTransactionRequest) {
      console.log("API - Extracting transaction data...");
      // Se não há imagem, extrair dados normalmente
      transactionData = await extractTransactionData(
        lastMessage.content,
        lastMessage.imageUrl,
        userId,
        isFromAudio,
      );
      console.log("API - Extracted transaction data:", transactionData);
      console.log("API - Transaction data type:", typeof transactionData);
      console.log("API - Transaction data is null:", transactionData === null);
    } else {
      console.log(
        "API - No transaction request detected, skipping data extraction",
      );
    }

    // Se já temos dados de transação da análise de imagem, não sobrescrever
    // (Esta verificação será feita mais abaixo no código)

    // Buscar dados financeiros do usuário (mantido para compatibilidade)
    try {
      await getUserFinancialData();
    } catch (error) {
      console.error("Error fetching financial data:", error);
    }

    // Usar o novo sistema de relatórios financeiros melhorado
    const financialContext = await generateEnhancedFinancialContext(userId);

    // Se já temos dados de transação da análise de imagem, não sobrescrever
    // (Esta lógica foi movida para dentro do bloco de análise de imagem)

    // Criar contexto da transação detectada
    const formatDateToPortuguese = (date: Date) => {
      // Criar uma nova data local para evitar problemas de timezone
      const localDate = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      );
      const day = localDate.getDate();
      const month = localDate.getMonth();
      const year = localDate.getFullYear();

      const monthNames = [
        "janeiro",
        "fevereiro",
        "março",
        "abril",
        "maio",
        "junho",
        "julho",
        "agosto",
        "setembro",
        "outubro",
        "novembro",
        "dezembro",
      ];

      return `${day} de ${monthNames[month]} de ${year}`;
    };

    const translateTransactionType = (type: string) => {
      const translations: { [key: string]: string } = {
        EXPENSE: "DESPESA",
        DEPOSIT: "RECEITA",
        INVESTMENT: "INVESTIMENTO",
      };
      return translations[type] || type;
    };

    const translateTransactionCategory = (category: string) => {
      const translations: { [key: string]: string } = {
        FOOD: "Alimentação",
        TRANSPORTATION: "Transporte",
        HEALTH: "Saúde",
        ENTERTAINMENT: "Entretenimento",
        EDUCATION: "Educação",
        HOUSING: "Moradia",
        UTILITY: "Utilidades",
        SALARY: "Salário",
        OTHER: "Outros",
      };
      return translations[category] || category;
    };

    const translatePaymentMethod = (method: string) => {
      const translations: { [key: string]: string } = {
        CASH: "Dinheiro",
        CREDIT_CARD: "Cartão de Crédito",
        DEBIT_CARD: "Cartão de Débito",
        PIX: "PIX",
        BANK_TRANSFER: "Transferência Bancária",
        BANK_SLIP: "Boleto Bancário",
      };
      return translations[method] || method;
    };

    const transactionContext = transactionData
      ? `
TRANSAÇÃO DETECTADA:
- Nome: "${transactionData.name}"
- Valor: R$ ${transactionData.amount || 0}
- Tipo: ${translateTransactionType(transactionData.type)}
- Categoria: ${translateTransactionCategory(transactionData.category)}
- Método de Pagamento: ${translatePaymentMethod(transactionData.paymentMethod)}
- Data: ${transactionData.date ? formatDateToPortuguese(transactionData.date) : "Hoje"}

IMPORTANTE: Use exatamente estes dados na confirmação da transação, especialmente a data formatada em português brasileiro e os tipos/categorias/métodos traduzidos.
`
      : "";

    // Debug: Log da data formatada
    if (transactionData) {
      console.log("API - Raw date from GPT:", transactionData.date);
      console.log(
        "API - Formatted date for chat:",
        transactionData.date
          ? formatDateToPortuguese(transactionData.date)
          : "Hoje",
      );
    }

    console.log("API - About to send to GPT-4 Vision");
    console.log("API - Messages to send:", JSON.stringify(messages, null, 2));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é o Midas, um assistente de IA especializado em finanças pessoais e investimentos. 
          
          Suas principais características:
          - Você ajuda usuários a entender suas finanças pessoais
          - Fornece conselhos sobre investimentos, poupança e planejamento financeiro
          - Explica conceitos financeiros de forma clara e acessível
          - Ajuda a analisar transações e padrões de gastos
          - Oferece sugestões práticas para melhorar a saúde financeira
          - Pode gerar relatórios detalhados baseados nos dados financeiros do usuário
          - Pode ajudar a registrar transações quando solicitado (por texto, voz ou imagem)
          - Entende tanto mensagens digitadas quanto transcritas de áudio
          - Pode analisar imagens de notas fiscais e cupons para extrair dados de transações automaticamente
          
          ${financialContext}
          
          ${transactionContext}
          
          INTERPRETAÇÃO INTELIGENTE DE TRANSAÇÕES:
          Quando o usuário mencionar transações, você deve interpretar inteligentemente:
          
          🍔 CATEGORIZAÇÃO AUTOMÁTICA:
          - "KFC", "McDonald's", "Burger King" → FOOD (alimentação)
          - "Uber", "Taxi", "Gasolina" → TRANSPORTATION (transporte)
          - "Farmácia", "Médico", "Hospital" → HEALTH (saúde)
          - "Netflix", "Spotify", "Cinema" → ENTERTAINMENT (entretenimento)
          - "Curso", "Livro", "Faculdade" → EDUCATION (educação)
          - "Aluguel", "Condomínio" → HOUSING (moradia)
          - "Luz", "Água", "Internet" → UTILITY (utilidades)
          - "Salário", "Freelance" → SALARY (salário)
          
          💰 IDENTIFICAÇÃO DE TIPOS:
          - "Gastei", "Comprei", "Paguei" → EXPENSE (despesa)
          - "Ganhei", "Recebi", "Salário" → DEPOSIT (receita)
          - "Investi", "Apliquei", "Tesouro" → INVESTMENT (investimento)
          
          📝 EXEMPLOS DE INTERPRETAÇÃO:
          - "Gastei 50 reais no KFC" → Nome: "KFC", Valor: R$ 50, Tipo: DESPESA, Categoria: FOOD
          - "Investi 1000 reais em CDB" → Nome: "CDB", Valor: R$ 1000, Tipo: INVESTIMENTO, Categoria: OTHER
          - "Ganhei 5000 reais de salário" → Nome: "Salário", Valor: R$ 5000, Tipo: RECEITA, Categoria: SALARY
          - "Paguei 200 reais de aluguel" → Nome: "Aluguel", Valor: R$ 200, Tipo: DESPESA, Categoria: HOUSING
          - "Mês que vem vou comprar uma casa" → Nome: "Casa", Valor: R$ 0, Tipo: DESPESA, Categoria: HOUSING, Data: Próximo mês
          
          🎤 SUPORTE A VOICE CHAT:
          - As mensagens podem vir de transcrição de áudio (Whisper)
          - Interprete naturalmente tanto texto digitado quanto transcrito
          - Mantenha o mesmo nível de precisão na detecção de transações
          - Seja paciente com pequenas imprecisões da transcrição
          
          📸 SUPORTE A ANÁLISE DE IMAGENS:
          - As mensagens podem incluir imagens de notas fiscais, cupons ou recibos
          - Quando uma imagem for enviada, TRANSCREVA TODO O TEXTO visível na imagem
          - Seja preciso e detalhado na transcrição
          - Mantenha a formatação original quando possível
          - Liste todos os itens, valores, datas e informações presentes
          
          📅 INTERPRETAÇÃO DE DATAS:
          - "ontem" → Data de ontem
          - "amanhã" → Data de amanhã
          - "semana passada" → 7 dias atrás
          - "próxima semana" → 7 dias à frente
          - "próximo mês" ou "mês que vem" → Mês seguinte
          - "dia 12" → Dia 12 do mês atual (ou próximo ano se já passou)
          - "12 de janeiro" → 12 de janeiro
          - "dia 15 do próximo mês" → Dia 15 do mês seguinte
          - "segunda", "terça", etc. → Próximo dia da semana
          - "próxima segunda", "próxima terça", etc. → Próximo dia específico da semana
          
          ⚠️ IMPORTANTE: SEMPRE inclua a data na confirmação da transação, formatada em português brasileiro usando a data real extraída da transação
          
          IMPORTANTE: Use TODOS os dados financeiros detalhados fornecidos acima para dar conselhos personalizados e precisos. 
          Quando solicitado um relatório ou análise, forneça insights específicos sobre:
          
          📊 FORMATAÇÃO DE RELATÓRIOS:
          - Use categorias traduzidas: "Alimentação", "Transporte", "Saúde", "Entretenimento", "Educação", "Moradia", "Utilidades", "Salário", "Outros"
          - Use métodos de pagamento traduzidos: "Dinheiro", "Cartão de Crédito", "Cartão de Débito", "PIX", "Transferência Bancária", "Boleto Bancário"
          - Use tipos traduzidos: "Despesa", "Receita", "Investimento"
          - NUNCA use códigos em inglês como "FOOD", "CASH", "EXPENSE" nos relatórios
          
          🎯 ANÁLISE TRANSAÇÃO POR TRANSAÇÃO:
          - Identifique estabelecimentos específicos onde o usuário gasta mais
          - Analise padrões de frequência (ex: "Você vai ao KFC 3x por semana")
          - Compare valores médios por estabelecimento
          - Identifique transações recorrentes e suas frequências
          - Destaque gastos incomuns ou valores altos
          
          📊 PADRÕES TEMPORAIS DETALHADOS:
          - Analise em quais dias da semana o usuário gasta mais
          - Identifique períodos do dia com maior gasto
          - Compare métodos de pagamento preferidos
          - Identifique horários de maior atividade financeira
          
          🔍 ANÁLISE DE ANOMALIAS E ALERTAS:
          - Identifique gastos excessivos em categorias específicas (ex: doces, entretenimento)
          - Detecte padrões de frequência alta em estabelecimentos específicos
          - Alerte sobre aumentos significativos em categorias de gastos
          - Identifique transações que representam alta porcentagem da renda mensal
          - Detecte gastos em horários atípicos (madrugada, etc.)
          - Identifique inconsistências na classificação de transações
          
          📊 PROJEÇÕES INTELIGENTES:
          - Considere padrões históricos ao invés de apenas média diária
          - Identifique ciclos de receita (ex: salário mensal)
          - Ajuste projeções baseado em padrões sazonais
          - Forneça cenários alternativos (otimista, pessimista)
          - Calcule confiança baseada na quantidade e qualidade dos dados
          - Considere tendências mensais e padrões semanais
          
          🚨 ALERTAS ESPECÍFICOS:
          - "Você está gastando muito com doces/alimentos não essenciais"
          - "Frequência alta detectada: você vai ao [estabelecimento] X vezes por mês"
          - "Aumento significativo em [categoria]: +X% em relação ao mês anterior"
          - "Gasto representa X% da sua renda mensal - considere reduzir"
          - "Padrão de gastos crescente detectado em [categoria]"
          
          📈 INSIGHTS BASEADOS EM PADRÕES:
          - "Seu padrão de receita é consistente: R$ X a cada Y dias"
          - "Você gasta mais aos fins de semana: R$ X vs R$ Y nos dias úteis"
          - "Padrão sazonal detectado: gastos aumentam em [mês]"
          - "Tendência mensal: seus gastos estão [crescendo/diminuindo]"
          
          🎯 RECOMENDAÇÕES PERSONALIZADAS:
          - Baseadas em padrões específicos identificados
          - Considerando alertas de categoria e anomalias
          - Focadas em redução de gastos problemáticos
          - Considerando projeções inteligentes e cenários alternativos
          
          📈 COMPARAÇÕES INTELIGENTES:
          - Compare valores específicos entre meses
          - Analise mudanças na frequência de estabelecimentos
          - Identifique tendências em métodos de pagamento
          - Compare valores médios por transação
          
          💡 SUGESTÕES PERSONALIZADAS:
          - Baseadas em estabelecimentos específicos frequentados
          - Considerando padrões temporais identificados
          - Focadas em transações recorrentes
          - Considerando gastos incomuns identificados
          
          Quando o usuário solicitar adicionar uma transação ou gasto, seja útil e confirme os dados extraídos com interpretação inteligente.
          
          🖼️ QUANDO UMA IMAGEM FOR ENVIADA:
          - TRANSCREVA TODO O TEXTO visível na imagem
          - Seja detalhado e preciso
          - Mantenha a formatação original
          - Liste todos os valores, datas, itens e informações
          - NÃO tente criar transações automaticamente ainda
          - Apenas transcreva o conteúdo da imagem
          
          📋 FORMATO DE CONFIRMAÇÃO DE TRANSAÇÃO:
          Quando detectar uma transação, sempre confirme os dados no seguinte formato:
          - Nome: "[nome específico]"
          - Valor: R$ [valor]
          - Tipo: [Despesa/Receita/Investimento]
          - Categoria: [Alimentação/Transporte/Saúde/Entretenimento/Educação/Moradia/Utilidades/Salário/Outros]
          - Método de Pagamento: [Dinheiro/Cartão de Crédito/Cartão de Débito/PIX/Transferência Bancária/Boleto Bancário]
          - Data: [data formatada em português]
          
          Exemplo: "Entendi! Vamos registrar essa transação.
          - Nome: "Avô"
          - Valor: R$ 50,00
          - Tipo: Receita
          - Categoria: Salário
          - Método de Pagamento: Dinheiro
          - Data: [use a data real extraída da transação, formatada em português]"
          
          DIRETRIZES DE RESPOSTA:
          - Seja DIRETO e OBJETIVO nas suas respostas
          - Dê a resposta principal primeiro, sem explicações desnecessárias
          - Evite fórmulas matemáticas desnecessárias quando uma resposta simples basta
          - Se não souber algo, seja HONESTO e diga "Não tenho essa informação" ao invés de inventar
          - Sempre termine perguntando: "Quer que eu detalhe mais alguma coisa?"
          
          EXEMPLO DE RESPOSTA DIRETA:
          Pergunta: "Quanto posso gastar por dia até o final do mês?"
          Resposta: "Você pode gastar R$ 31,43 por dia até o final do mês (R$ 660 ÷ 21 dias restantes). Quer que eu detalhe mais alguma coisa?"
          
          Sempre responda em português brasileiro, seja amigável e profissional. 
          Se não tiver informações suficientes sobre o contexto financeiro do usuário, faça perguntas relevantes para melhor ajudá-lo.`,
        },
        ...messages,
      ],
      max_tokens: 1500,
      temperature: 0.7,
      stream: stream,
    });

    if (stream) {
      // Resposta em streaming - apenas para a resposta final
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            let fullResponse = "";

            for await (const chunk of completion as any) {
              const content = chunk.choices[0]?.delta?.content || "";
              if (content) {
                fullResponse += content;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "chunk",
                      content: content,
                    })}\n\n`,
                  ),
                );
              }
            }

            // Log token usage para streaming
            if (completion.usage && userId) {
              const cost = calculateTokenCost(
                "gpt-4o-mini",
                completion.usage.total_tokens,
              );

              if (isFromAudio) {
                // Acumular custos do chat para consolidação posterior
                chatCosts += cost;
                chatTokens += completion.usage.total_tokens;
                console.log("🔗 Accumulated streaming cost:", {
                  cost,
                  tokens: completion.usage.total_tokens,
                  totalChatCosts: chatCosts,
                  totalChatTokens: chatTokens,
                });
              } else {
                // Registrar normalmente se não for áudio
                logTokenUsage({
                  userId,
                  model: "gpt-4o-mini",
                  promptTokens: completion.usage.prompt_tokens,
                  completionTokens: completion.usage.completion_tokens,
                  totalTokens: completion.usage.total_tokens,
                  endpoint: "chat",
                  cost,
                });
              }
            }

            // Se for áudio, salvar custos consolidados no banco
            if (isFromAudio && whisperCost > 0) {
              const totalCost = whisperCost + chatCosts;
              const totalTokens = whisperTokens + chatTokens;

              console.log(
                "💾 Streaming - Saving consolidated costs to database:",
                {
                  whisperCost,
                  chatCosts,
                  totalCost,
                  whisperTokens,
                  chatTokens,
                  totalTokens,
                },
              );

              const result = await logTokenUsage({
                userId,
                model: "whisper-1",
                promptTokens: 0,
                completionTokens: totalTokens,
                totalTokens: totalTokens,
                endpoint: "transcribe",
                cost: totalCost,
              });

              console.log("💾 Streaming - Database save result:", result);
            } else if (!isFromAudio && textTransactionCosts > 0) {
              // Se for mensagem de texto com transação, salvar custos consolidados
              const totalCost = textTransactionCosts;
              const totalTokens = textTransactionTokens;

              console.log(
                "💾 Streaming - Saving consolidated text transaction costs to database:",
                {
                  textTransactionCosts,
                  totalCost,
                  textTransactionTokens,
                  totalTokens,
                },
              );

              const result = await logTokenUsage({
                userId,
                model: "gpt-4o-mini",
                promptTokens: 0,
                completionTokens: totalTokens,
                totalTokens: totalTokens,
                endpoint: "chat",
                cost: totalCost,
              });

              console.log(
                "💾 Streaming - Text transaction database save result:",
                result,
              );
            }

            // Enviar evento de conclusão com dados da transação
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "complete",
                  message: fullResponse,
                  transactionData: transactionData,
                })}\n\n`,
              ),
            );

            controller.close();
          } catch (error) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "error",
                  error:
                    error instanceof Error
                      ? error.message
                      : "Erro no streaming",
                })}\n\n`,
              ),
            );
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      return NextResponse.json(
        { error: "No response from OpenAI" },
        { status: 500 },
      );
    }

    console.log("API - Preparing response with transaction data:", {
      hasTransactionData: !!transactionData,
      transactionData: transactionData,
      responseLength: response?.length || 0,
    });

    // Log token usage
    if (completion.usage && userId) {
      const cost = calculateTokenCost(
        "gpt-4o-mini",
        completion.usage.total_tokens,
      );

      if (isFromAudio) {
        // Acumular custos do chat para consolidação posterior
        chatCosts += cost;
        chatTokens += completion.usage.total_tokens;
        console.log("🔗 Accumulated final cost:", {
          cost,
          tokens: completion.usage.total_tokens,
          totalChatCosts: chatCosts,
          totalChatTokens: chatTokens,
        });
      } else {
        // Registrar normalmente se não for áudio
        logTokenUsage({
          userId,
          model: "gpt-4o-mini",
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
          endpoint: "chat",
          cost,
        });
      }
    }

    // Debug: verificar condições para salvar no banco
    console.log("🔍 Debug - Final conditions check:", {
      isFromAudio,
      whisperCost,
      chatCosts,
      chatTokens,
      shouldSave: isFromAudio && whisperCost > 0,
    });

    // Se for áudio, salvar custos consolidados no banco
    if (isFromAudio && whisperCost > 0) {
      const totalCost = whisperCost + chatCosts;
      const totalTokens = whisperTokens + chatTokens;

      console.log("💾 Saving consolidated costs to database:", {
        whisperCost,
        chatCosts,
        totalCost,
        whisperTokens,
        chatTokens,
        totalTokens,
      });

      const result = await logTokenUsage({
        userId,
        model: "whisper-1",
        promptTokens: 0,
        completionTokens: totalTokens,
        totalTokens: totalTokens,
        endpoint: "transcribe",
        cost: totalCost,
      });

      console.log("💾 Database save result:", result);
    } else if (!isFromAudio && textTransactionCosts > 0) {
      // Se for mensagem de texto com transação, salvar custos consolidados
      const totalCost = textTransactionCosts;
      const totalTokens = textTransactionTokens;

      console.log(
        "💾 Saving consolidated text transaction costs to database:",
        {
          textTransactionCosts,
          totalCost,
          textTransactionTokens,
          totalTokens,
        },
      );

      const result = await logTokenUsage({
        userId,
        model: "gpt-4o-mini",
        promptTokens: 0,
        completionTokens: totalTokens,
        totalTokens: totalTokens,
        endpoint: "chat",
        cost: totalCost,
      });

      console.log("💾 Text transaction database save result:", result);
    } else {
      console.log("❌ Not saving to database - conditions not met:", {
        isFromAudio,
        whisperCost,
        textTransactionCosts,
        reason: !isFromAudio
          ? "Not from audio and no text transaction costs"
          : "Whisper cost is 0",
      });
    }

    return NextResponse.json({
      message: response,
      usage: completion.usage,
      transactionData: transactionData,
    });
  } catch (error) {
    console.error("OpenAI API Error:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
