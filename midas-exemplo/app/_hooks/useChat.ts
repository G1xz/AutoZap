"use client";

import { useState, useCallback } from "react";
import { TransactionPaymentMethod, TransactionType } from "@prisma/client";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  imageUrl?: string;
  isFromAudio?: boolean; // Indica se a mensagem veio de áudio transcrito
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  hasFinancialData: boolean;
  isProcessingAudio: boolean;
  isStreaming: boolean;
  limitReached?: {
    type: string;
    message: string;
  } | null;
}

export interface TransactionData {
  name: string;
  amount: number | null;
  category: string;
  paymentMethod: TransactionPaymentMethod;
  type: TransactionType;
  date: Date | null;
}

export interface ChatResponse {
  message: string;
  transactionData?: {
    name: string;
    amount: number | null;
    category: string;
    paymentMethod: TransactionPaymentMethod;
    type: TransactionType;
    date: string | null; // Vem como string do JSON
  } | null;
}

interface UseChatOptions {
  onTransactionDetected?: (transactionData: TransactionData) => void;
}

export function useChat(options: UseChatOptions = {}) {
  const { onTransactionDetected } = options;

  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
    hasFinancialData: true, // Assumimos que tem dados financeiros por padrão
    isProcessingAudio: false,
    isStreaming: false,
    limitReached: null,
  });

  const addMessage = useCallback(
    (message: Omit<ChatMessage, "id" | "timestamp">) => {
      const newMessage: ChatMessage = {
        ...message,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, newMessage],
      }));

      return newMessage.id;
    },
    [],
  );

  const sendMessage = useCallback(
    async (content: string, imageFile?: File, isFromAudio?: boolean) => {
      if (!content.trim() && !imageFile) return;

      let imageUrl: string | undefined;

      // Função auxiliar para enviar mensagem com imagem
      const sendMessageWithImage = async (
        messageContent: string,
        imgUrl: string,
      ) => {
        // Adiciona mensagem do usuário
        addMessage({
          role: "user",
          content: messageContent.trim() || "Analise esta imagem",
          imageUrl: imgUrl,
          isFromAudio: isFromAudio || false,
        });

        setState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));

        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messages: [
                ...state.messages.map((msg) => ({
                  role: msg.role,
                  content: msg.content,
                  imageUrl: msg.imageUrl,
                })),
                {
                  role: "user",
                  content: messageContent.trim() || "Analise esta imagem",
                  imageUrl: imgUrl,
                },
              ],
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();

            // Verificar se é um erro de limite atingido
            if (errorData.error === "LIMIT_REACHED") {
              console.log("LIMIT_REACHED detectado:", errorData);
              // Em vez de lançar erro, vamos sinalizar que o limite foi atingido
              setState((prev) => ({
                ...prev,
                isLoading: false,
                isStreaming: false,
                limitReached: {
                  type: errorData.limitType,
                  message: errorData.message,
                },
              }));
              return;
            }

            throw new Error(errorData.error || "Erro ao enviar mensagem");
          }

          const data: ChatResponse = await response.json();

          // Adiciona resposta da IA
          addMessage({
            role: "assistant",
            content: data.message,
          });

          // Se dados de transação foram detectados, chama o callback
          if (data.transactionData && onTransactionDetected) {
            console.log(
              "useChat - Raw transaction data from API:",
              data.transactionData,
            );
            // Converter a data de string para Date se necessário
            const transactionData: TransactionData = {
              ...data.transactionData,
              date: data.transactionData.date
                ? (() => {
                    const parsedDate = new Date(data.transactionData.date);
                    return isNaN(parsedDate.getTime())
                      ? new Date()
                      : parsedDate;
                  })()
                : null,
            };
            console.log(
              "useChat - Processed transaction data:",
              transactionData,
            );
            onTransactionDetected(transactionData);
          }
        } catch (error) {
          console.error("Chat error:", error);
          setState((prev) => ({
            ...prev,
            error: error instanceof Error ? error.message : "Erro desconhecido",
          }));
        } finally {
          setState((prev) => ({
            ...prev,
            isLoading: false,
          }));
        }
      };

      // Se há uma imagem, converter para base64 para o GPT-4 Vision
      if (imageFile) {
        try {
          // Converter imagem para base64
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = reader.result as string;
            imageUrl = base64;
            console.log("useChat - Image converted to base64");

            // Continuar com o envio da mensagem
            await sendMessageWithImage(content, imageUrl);
          };
          reader.readAsDataURL(imageFile);
          return; // Retornar aqui para aguardar a conversão
        } catch (error) {
          console.error("Image conversion error:", error);
          setState((prev) => ({
            ...prev,
            error: "Erro ao processar a imagem",
          }));
          return;
        }
      }

      // Se não há imagem, enviar mensagem normalmente
      if (!imageFile) {
        // Adiciona mensagem do usuário
        addMessage({
          role: "user",
          content: content.trim(),
          isFromAudio: isFromAudio || false,
        });

        setState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));

        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messages: [
                ...state.messages.map((msg) => ({
                  role: msg.role,
                  content: msg.content,
                  imageUrl: msg.imageUrl,
                  isFromAudio: msg.isFromAudio,
                })),
                {
                  role: "user",
                  content: content.trim(),
                  isFromAudio: isFromAudio || false,
                },
              ],
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Erro ao enviar mensagem");
          }

          const data: ChatResponse = await response.json();

          // Adiciona resposta da IA
          addMessage({
            role: "assistant",
            content: data.message,
          });

          // Se dados de transação foram detectados, chama o callback
          if (data.transactionData && onTransactionDetected) {
            console.log(
              "useChat - Raw transaction data from API:",
              data.transactionData,
            );
            // Converter a data de string para Date se necessário
            const transactionData: TransactionData = {
              ...data.transactionData,
              date: data.transactionData.date
                ? (() => {
                    const parsedDate = new Date(data.transactionData.date);
                    return isNaN(parsedDate.getTime())
                      ? new Date()
                      : parsedDate;
                  })()
                : null,
            };
            console.log(
              "useChat - Processed transaction data:",
              transactionData,
            );
            onTransactionDetected(transactionData);
          }
        } catch (error) {
          console.error("Chat error:", error);
          setState((prev) => ({
            ...prev,
            error: error instanceof Error ? error.message : "Erro desconhecido",
          }));
        } finally {
          setState((prev) => ({
            ...prev,
            isLoading: false,
          }));
        }
      }
    },
    [state.messages, addMessage],
  );

  const processAudio = useCallback(
    async (audioBlob: Blob) => {
      setState((prev) => ({
        ...prev,
        isProcessingAudio: true,
        error: null,
      }));

      try {
        // Criar FormData para enviar o arquivo de áudio
        const formData = new FormData();
        formData.append("audio", audioBlob, "audio.wav");

        const response = await fetch("/api/audio/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();

          // Verificar se é um erro de limite atingido
          if (errorData.error === "LIMIT_REACHED") {
            console.log("LIMIT_REACHED detectado no áudio:", errorData);
            // Em vez de lançar erro, vamos sinalizar que o limite foi atingido
            setState((prev) => ({
              ...prev,
              isProcessingAudio: false,
              limitReached: {
                type: errorData.limitType,
                message: errorData.message,
              },
            }));
            return;
          }

          // Tratamento específico de erros baseado no status HTTP
          let errorMessage = "Erro ao processar áudio";

          if (response.status === 503) {
            errorMessage =
              "Serviço temporariamente indisponível. Tente novamente em alguns segundos.";
          } else if (response.status === 408) {
            errorMessage =
              "Timeout ao processar o áudio. Tente com uma gravação mais curta.";
          } else if (response.status === 400) {
            errorMessage = errorData.error || "Arquivo de áudio inválido.";
          } else if (response.status === 500) {
            errorMessage = "Erro interno do servidor. Tente novamente.";
          } else {
            errorMessage = errorData.error || errorMessage;
          }

          throw new Error(errorMessage);
        }

        const data = await response.json();

        // Se o áudio foi transcrito com sucesso, enviar o texto para o chat
        // O texto transcrito será processado normalmente pelo chat, incluindo detecção de transações
        if (data.text && data.text.trim()) {
          // Adicionar flag para indicar que veio de áudio e enviar os custos do Whisper
          await sendMessageStream(data.text, undefined, true, {
            whisperCost: data.whisperCost,
            whisperTokens: data.whisperTokens,
          });
        } else {
          throw new Error(
            "Não foi possível transcrever o áudio. Tente falar mais claramente.",
          );
        }
      } catch (error) {
        console.error("Audio processing error:", error);
        setState((prev) => ({
          ...prev,
          error:
            error instanceof Error ? error.message : "Erro ao processar áudio",
        }));
      } finally {
        setState((prev) => ({
          ...prev,
          isProcessingAudio: false,
        }));
      }
    },
    [sendMessage],
  );

  const clearMessages = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messages: [],
      error: null,
    }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null,
    }));
  }, []);

  // Função para sugerir prompts de relatórios
  const getSuggestedPrompts = useCallback(() => {
    return [
      "Gere um relatório completo da minha situação financeira",
      "Analise meus gastos por categoria este mês",
      "Como posso economizar mais dinheiro?",
      "Qual é a tendência dos meus gastos?",
      "Me dê sugestões de investimento baseadas no meu perfil",
      "Compare meus gastos deste mês com o anterior",
      "Identifique padrões nos meus gastos",
      "Quais são minhas maiores despesas?",
    ];
  }, []);

  // Função de streaming simples - mantém todas as funcionalidades originais
  const sendMessageStream = useCallback(
    async (
      content: string,
      imageFile?: File,
      isFromAudio?: boolean,
      whisperData?: { whisperCost: number; whisperTokens: number },
    ) => {
      if (!content.trim() && !imageFile) return;

      let imageUrl: string | undefined;

      // Processar imagem se fornecida (igual ao original)
      if (imageFile) {
        try {
          console.log(
            "📤 Uploading image:",
            imageFile.name,
            imageFile.size,
            "bytes",
          );

          const formData = new FormData();
          formData.append("image", imageFile);

          const uploadResponse = await fetch("/api/upload-image", {
            method: "POST",
            body: formData,
          });

          console.log("📤 Upload response status:", uploadResponse.status);

          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            imageUrl = uploadData.imageUrl;
            console.log("✅ Image uploaded successfully:", imageUrl);
          } else {
            const errorData = await uploadResponse.text();
            console.log("❌ Upload failed:", uploadResponse.status, errorData);
          }
        } catch (error) {
          console.error("Error uploading image:", error);
          setState((prev) => ({
            ...prev,
            error: "Erro ao fazer upload da imagem",
          }));
          return;
        }
      }

      // Adicionar mensagem do usuário
      addMessage({
        role: "user",
        content: content.trim() || "Analise esta imagem",
        imageUrl: imageUrl,
        isFromAudio: isFromAudio || false,
      });

      // Adicionar mensagem vazia do assistente para streaming
      const assistantMessageId = addMessage({
        role: "assistant",
        content: "",
      });

      setState((prev) => ({
        ...prev,
        isLoading: true,
        isStreaming: true,
        error: null,
      }));

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [
              ...state.messages.map((msg) => ({
                role: msg.role,
                content: msg.content,
                ...(msg.imageUrl && { imageUrl: msg.imageUrl }),
                isFromAudio: msg.isFromAudio,
              })),
              {
                role: "user",
                content: content.trim() || "Analise esta imagem",
                ...(imageUrl && { imageUrl }),
                isFromAudio: isFromAudio || false,
              },
            ],
            stream: true,
            whisperData: whisperData,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();

          // Verificar se é um erro de limite atingido
          if (errorData.error === "LIMIT_REACHED") {
            console.log("LIMIT_REACHED detectado:", errorData);
            // Em vez de lançar erro, vamos sinalizar que o limite foi atingido
            setState((prev) => ({
              ...prev,
              isLoading: false,
              isStreaming: false,
              limitReached: {
                type: errorData.limitType,
                message: errorData.message,
              },
            }));
            return;
          }

          throw new Error(errorData.error || "Erro ao enviar mensagem");
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Erro ao ler resposta");
        }

        let fullResponse = "";
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === "chunk") {
                  fullResponse += data.content;
                  // Atualizar mensagem em tempo real
                  setState((prev) => ({
                    ...prev,
                    messages: prev.messages.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: fullResponse }
                        : msg,
                    ),
                  }));
                } else if (data.type === "complete") {
                  // Finalizar mensagem
                  setState((prev) => ({
                    ...prev,
                    messages: prev.messages.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: data.message }
                        : msg,
                    ),
                    isLoading: false,
                    isStreaming: false,
                  }));

                  // Verificar se há dados de transação (igual ao original)
                  if (data.transactionData && onTransactionDetected) {
                    const processedTransactionData: TransactionData = {
                      ...data.transactionData,
                      date: data.transactionData.date
                        ? (() => {
                            const parsedDate = new Date(
                              data.transactionData.date,
                            );
                            return isNaN(parsedDate.getTime())
                              ? new Date()
                              : parsedDate;
                          })()
                        : null,
                    };
                    onTransactionDetected(processedTransactionData);
                  }
                  break;
                } else if (data.type === "error") {
                  throw new Error(data.error);
                }
              } catch (parseError) {
                console.error("Error parsing SSE data:", parseError);
              }
            }
          }
        }
      } catch (error) {
        console.error("Streaming error:", error);
        setState((prev) => ({
          ...prev,
          error:
            error instanceof Error ? error.message : "Erro ao enviar mensagem",
          isLoading: false,
          isStreaming: false,
        }));
      }
    },
    [state.messages, addMessage, onTransactionDetected],
  );

  return {
    ...state,
    sendMessage,
    sendMessageStream,
    addMessage,
    clearMessages,
    clearError,
    getSuggestedPrompts,
    processAudio,
  };
}
