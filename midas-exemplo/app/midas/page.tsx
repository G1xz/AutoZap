"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { cn } from "@/app/_lib/utils";
import {
  ImageIcon,
  Figma,
  MonitorIcon,
  SendIcon,
  XIcon,
  LoaderIcon,
  Sparkles,
  Command,
  Mic,
  MicOff,
  Play,
  Square,
  RotateCcw,
  Brain,
  Camera,
  FolderOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as React from "react";
import Image from "next/image";
import Navbar from "../_components/navbar";
import { useChat, TransactionData } from "@/app/_hooks/useChat";
import LimitReachedGate from "@/app/_components/limit-reached-gate";
import {
  canUserSendImage,
  canUserSendAudio,
  canUserSendMessage,
  getUserPlan,
} from "@/app/_lib/plan-limits";
import { MessageBubble } from "@/app/_components/chat-messages";
import UpsertTransactionDialog from "@/app/_components/upsert-transaction-dialog";
import PremiumGate from "@/app/_components/premium-gate";
import { CameraCapture } from "@/app/_components/camera-capture";
import { Button } from "@/app/_components/ui/button";
import imageCompression from "browser-image-compression";

interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({
  minHeight,
  maxHeight,
}: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY),
      );

      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight],
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = `${minHeight}px`;
    }
  }, [minHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

interface CommandSuggestion {
  icon: React.ReactNode;
  label: string;
  description: string;
  prefix: string;
}

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  containerClassName?: string;
  showRing?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, containerClassName, showRing = true, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);

    return (
      <div className={cn("relative", containerClassName)}>
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "transition-all duration-200 ease-in-out",
            "placeholder:text-muted-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
            showRing
              ? "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
              : "",
            className,
          )}
          ref={ref}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {showRing && isFocused && (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-primary/30 ring-offset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}

        {props.onChange && (
          <div
            className="absolute bottom-2 right-2 h-2 w-2 rounded-full bg-primary opacity-0"
            style={{
              animation: "none",
            }}
            id="textarea-ripple"
          />
        )}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

export default function AnimatedAIChat() {
  const [value, setValue] = useState("");
  const [userScrolled, setUserScrolled] = useState(false);
  const mobileChatRef = useRef<HTMLDivElement>(null);
  const desktopChatRef = useRef<HTMLDivElement>(null);
  const [activeSuggestion, setActiveSuggestion] = useState<number>(-1);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [inputFocused, setInputFocused] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [transactionData, setTransactionData] =
    useState<TransactionData | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [showCameraCapture, setShowCameraCapture] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitType, setLimitType] = useState<string>("");
  const [userPlan, setUserPlan] = useState<string>("");

  // Carregar plano do usuário
  useEffect(() => {
    const fetchUserPlan = async () => {
      try {
        const response = await fetch("/api/check-usage-limits");
        const data = await response.json();
        setUserPlan(data.plan);
      } catch (error) {
        console.error("Erro ao carregar plano do usuário:", error);
      }
    };

    fetchUserPlan();
  }, []);

  // Fechar menu de opções quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showImageOptions) {
        const target = event.target as Element;
        if (!target.closest(".image-options-menu")) {
          setShowImageOptions(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showImageOptions]);

  // Funções para verificar limites
  const checkImageLimit = async () => {
    if (userPlan === "start") {
      try {
        const response = await fetch("/api/check-usage-limits");
        const data = await response.json();
        if (data.limits.images.reached) {
          setLimitType("images");
          setShowLimitModal(true);
          return false;
        }
      } catch (error) {
        console.error("Erro ao verificar limite de imagens:", error);
      }
    }
    return true;
  };

  const checkAudioLimit = async () => {
    if (userPlan === "start") {
      try {
        const response = await fetch("/api/check-usage-limits");
        const data = await response.json();
        if (data.limits.audios.reached) {
          setLimitType("audios");
          setShowLimitModal(true);
          return false;
        }
      } catch (error) {
        console.error("Erro ao verificar limite de áudios:", error);
      }
    }
    return true;
  };

  const checkMessageLimit = async () => {
    if (userPlan === "start") {
      try {
        const response = await fetch("/api/check-usage-limits");
        const data = await response.json();
        if (data.limits.messages.reached) {
          setLimitType("messages");
          setShowLimitModal(true);
          return false;
        }
      } catch (error) {
        console.error("Erro ao verificar limite de mensagens:", error);
      }
    }
    return true;
  };

  // Handle transaction detection
  const handleTransactionDetected = useCallback((data: TransactionData) => {
    console.log("midas/page - Transaction detected:", data);
    setTransactionData(data);
    setTransactionDialogOpen(true);
  }, []);

  // Handle image selection with compression
  const handleImageSelect = useCallback(async (file: File) => {
    // Verificar limite antes de processar
    const canSend = await checkImageLimit();
    if (!canSend) {
      return;
    }

    console.log(
      "🖼️ Arquivo selecionado:",
      file.name,
      "Tamanho:",
      (file.size / 1024).toFixed(2),
      "KB",
    );

    if (file && file.type.startsWith("image/")) {
      setIsProcessingImage(true);

      try {
        console.log("⚡ Iniciando compressão...");

        // Configurações de compressão
        const options = {
          maxSizeMB: 0.5, // 500 KB
          maxWidthOrHeight: 1024,
          useWebWorker: true,
        };

        console.log(
          "📊 Tamanho original:",
          (file.size / 1024).toFixed(2),
          "KB",
        );

        // Comprimir a imagem
        const compressedFile = await imageCompression(file, options);

        console.log("✅ Compressão concluída!");
        console.log(
          "📊 Tamanho comprimido:",
          (compressedFile.size / 1024).toFixed(2),
          "KB",
        );
        console.log(
          "📈 Redução:",
          ((1 - compressedFile.size / file.size) * 100).toFixed(1) + "%",
        );

        // Usar arquivo comprimido
        setSelectedImage(compressedFile);

        // Feedback visual de sucesso
        setTimeout(() => {
          console.log("🎉 Imagem processada e pronta para envio!");
        }, 100);
      } catch (error) {
        console.error("❌ Erro ao comprimir imagem:", error);
        console.log("🔄 Usando arquivo original como fallback");

        // Fallback: usar arquivo original se a compressão falhar
        setSelectedImage(file);
      } finally {
        setIsProcessingImage(false);
      }
    } else {
      console.log("❌ Arquivo não é uma imagem válida");
    }
  }, []);

  // Handle camera capture
  const handleCameraCapture = useCallback(
    async (file: File) => {
      // Verificar limite antes de processar
      const canSend = await checkImageLimit();
      if (!canSend) {
        setShowCameraCapture(false);
        return;
      }

      await handleImageSelect(file);
      setShowCameraCapture(false);
    },
    [handleImageSelect, checkImageLimit],
  );

  // Handle gallery selection
  const handleGallerySelect = useCallback(async () => {
    // Verificar limite antes de abrir seletor
    const canSend = await checkImageLimit();
    if (!canSend) {
      return;
    }

    document.getElementById("image-upload")?.click();
  }, [checkImageLimit]);

  // Chat hook
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    sendMessageStream,
    clearMessages,
    getSuggestedPrompts,
    processAudio,
    isProcessingAudio,
    isStreaming,
    limitReached,
  } = useChat({
    onTransactionDetected: handleTransactionDetected,
  });

  // Obter sugestões de prompts
  const suggestedPrompts = getSuggestedPrompts();

  // Auto-scroll quando há novas mensagens ou quando está carregando/streaming
  useEffect(() => {
    if (!userScrolled) {
      // Scroll para mobile
      if (mobileChatRef.current) {
        mobileChatRef.current.scrollTop = mobileChatRef.current.scrollHeight;
      }
      // Scroll para desktop
      if (desktopChatRef.current) {
        desktopChatRef.current.scrollTop = desktopChatRef.current.scrollHeight;
      }
    }
  }, [messages, isLoading, isStreaming, userScrolled]);

  // Detectar se o usuário fez scroll manual
  const handleScroll = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      const { scrollTop, scrollHeight, clientHeight } = ref.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px de tolerância
      setUserScrolled(!isAtBottom);
    }
  };

  // Reset do scroll do usuário quando uma nova mensagem é adicionada
  useEffect(() => {
    if (messages.length > 0) {
      setUserScrolled(false);
    }
  }, [messages.length]);

  // Timer para alternar sugestões a cada 5 segundos
  useEffect(() => {
    if (messages.length === 0) {
      const interval = setInterval(() => {
        setCurrentSuggestionIndex(
          (prevIndex) => (prevIndex + 1) % suggestedPrompts.length,
        );
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [messages.length, suggestedPrompts.length]);

  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 200,
  });
  const commandPaletteRef = useRef<HTMLDivElement>(null);

  const commandSuggestions: CommandSuggestion[] = useMemo(
    () => [
      {
        icon: <Sparkles className="h-4 w-4" />,
        label: "Análise Financeira",
        description: "Analise meus gastos e receitas",
        prefix: "/analise",
      },
      {
        icon: <MonitorIcon className="h-4 w-4" />,
        label: "Relatório Mensal",
        description: "Gere um relatório do mês atual",
        prefix: "/relatorio",
      },
      {
        icon: <ImageIcon className="h-4 w-4" />,
        label: "Dicas de Investimento",
        description: "Receba conselhos de investimento",
        prefix: "/investir",
      },
      {
        icon: <Figma className="h-4 w-4" />,
        label: "Planejamento",
        description: "Crie um plano financeiro",
        prefix: "/planejar",
      },
    ],
    [],
  );

  useEffect(() => {
    if (value.startsWith("/") && !value.includes(" ")) {
      setShowCommandPalette(true);

      const matchingSuggestionIndex = commandSuggestions.findIndex((cmd) =>
        cmd.prefix.startsWith(value),
      );

      if (matchingSuggestionIndex >= 0) {
        setActiveSuggestion(matchingSuggestionIndex);
      } else {
        setActiveSuggestion(-1);
      }
    } else {
      setShowCommandPalette(false);
    }
  }, [value, commandSuggestions]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const commandButton = document.querySelector("[data-command-button]");

      if (
        commandPaletteRef.current &&
        !commandPaletteRef.current.contains(target) &&
        !commandButton?.contains(target)
      ) {
        setShowCommandPalette(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Cleanup audio recording on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommandPalette) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSuggestion((prev) =>
          prev < commandSuggestions.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggestion((prev) =>
          prev > 0 ? prev - 1 : commandSuggestions.length - 1,
        );
      } else if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        if (activeSuggestion >= 0) {
          const selectedCommand = commandSuggestions[activeSuggestion];
          setValue(selectedCommand.prefix + " ");
          setShowCommandPalette(false);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowCommandPalette(false);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        handleSendMessage();
      }
    }
  };

  const handleSendMessage = async () => {
    if (value.trim() || audioBlob || selectedImage) {
      const messageToSend = value.trim();

      if (audioBlob && !messageToSend && !selectedImage) {
        // Se há apenas áudio, processar o áudio
        await processAudio(audioBlob);
        clearAudio();
      } else if (messageToSend || selectedImage) {
        // Verificar limite de mensagens antes de enviar
        if (messageToSend && !selectedImage) {
          const canSend = await checkMessageLimit();
          if (!canSend) {
            return;
          }
        }

        // Se há texto ou imagem, enviar normalmente
        if (selectedImage) {
          // Para imagens, usar sistema original sem streaming
          await sendMessage(messageToSend, selectedImage || undefined);
        } else {
          // Para texto, usar streaming
          await sendMessageStream(messageToSend, selectedImage || undefined);
        }
        setValue("");
        setSelectedImage(null);
        clearAudio();
      }

      adjustHeight(true);
    }
  };

  const selectCommandSuggestion = (index: number) => {
    const selectedCommand = commandSuggestions[index];
    setValue(selectedCommand.prefix + " ");
    setShowCommandPalette(false);
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const audioChunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
        setAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const playAudio = () => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const clearAudio = () => {
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingTime(0);
    setIsPlaying(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Debug: verificar se limitReached está sendo definido
  console.log("limitReached:", limitReached);

  // Se o limite foi atingido, mostrar a tela de limite
  if (limitReached) {
    console.log("Mostrando tela de limite para:", limitReached.type);
    return (
      <div className="midas-page">
        <Navbar />
        <LimitReachedGate
          limitType={limitReached.type as any}
          currentUsage={0}
          limit={0}
          plan="Start"
        >
          <div />
        </LimitReachedGate>
      </div>
    );
  }

  return (
    <div className="midas-page">
      <Navbar />

      <PremiumGate feature="Midas AI">
        {/* Audio element for playback */}
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            onPause={() => setIsPlaying(false)}
          />
        )}
        <div className="flex w-full max-w-full overflow-x-hidden">
          <div className="relative flex h-[calc(100vh-6rem)] w-full max-w-full flex-col bg-transparent text-foreground">
            <div className="absolute inset-0 h-full w-full overflow-hidden">
              <div className="absolute left-1/4 top-0 h-96 w-96 animate-pulse rounded-full bg-primary/10 mix-blend-normal blur-[128px] filter" />
              <div className="absolute bottom-0 right-1/4 h-96 w-96 animate-pulse rounded-full bg-secondary/10 mix-blend-normal blur-[128px] filter delay-700" />
              <div className="absolute right-1/3 top-1/4 h-64 w-64 animate-pulse rounded-full bg-primary/10 mix-blend-normal blur-[96px] filter delay-1000" />
            </div>

            {/* Mobile Layout - Chat simples */}
            <div className="relative z-10 flex h-[calc(100vh-6rem-4rem)] max-w-full flex-col p-3 pb-16 md:hidden">
              {/* Chat Mobile */}
              <div className="mx-auto flex h-full w-full max-w-md flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card/80 shadow-lg backdrop-blur-xl">
                {/* Chat Messages Mobile */}
                <div
                  ref={mobileChatRef}
                  onScroll={() => handleScroll(mobileChatRef)}
                  className="chat-messages-mobile scrollbar-theme flex-1 space-y-2 overflow-y-auto p-3"
                >
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-4 text-center">
                      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <Brain className="icon-shine h-4 w-4 text-primary" />
                      </div>
                      <h3 className="mb-1 text-xs font-semibold">
                        Seu assistente de IA em finanças
                      </h3>
                      <p className="mb-3 max-w-xs text-xs text-muted-foreground">
                        Como posso ajudar hoje?
                      </p>

                      {/* Sugestão única com rotação */}
                      <div className="w-full max-w-sm sm:max-w-xs">
                        <p className="mb-2 text-sm text-muted-foreground sm:mb-1 sm:text-xs">
                          Tente perguntar:
                        </p>
                        <div className="relative min-h-12 sm:min-h-8">
                          <AnimatePresence mode="wait">
                            <motion.button
                              key={currentSuggestionIndex}
                              onClick={async () => {
                                const canSend = await checkMessageLimit();
                                if (!canSend) {
                                  return;
                                }
                                sendMessage(
                                  suggestedPrompts[currentSuggestionIndex],
                                );
                              }}
                              className="absolute inset-0 flex min-h-12 w-full items-center justify-center rounded-lg border border-border p-3 text-center text-sm transition-colors hover:bg-muted/50 sm:min-h-8 sm:p-2 sm:text-xs"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.3 }}
                            >
                              {suggestedPrompts[currentSuggestionIndex]}
                            </motion.button>
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {messages.map((message, index) => (
                        <MessageBubble
                          key={message.id}
                          message={message}
                          isLast={index === messages.length - 1}
                        />
                      ))}

                      {isLoading && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mb-2 flex gap-2"
                        >
                          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                            <Brain className="icon-shine h-3 w-3 text-primary" />
                          </div>
                          <div className="rounded-lg bg-muted px-2 py-1">
                            <div className="flex items-center gap-1">
                              <div className="flex space-x-1">
                                <motion.div
                                  className="h-1 w-1 rounded-full bg-muted-foreground"
                                  animate={{ opacity: [0.3, 1, 0.3] }}
                                  transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    delay: 0,
                                  }}
                                />
                                <motion.div
                                  className="h-1 w-1 rounded-full bg-muted-foreground"
                                  animate={{ opacity: [0.3, 1, 0.3] }}
                                  transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    delay: 0.2,
                                  }}
                                />
                                <motion.div
                                  className="h-1 w-1 rounded-full bg-muted-foreground"
                                  animate={{ opacity: [0.3, 1, 0.3] }}
                                  transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    delay: 0.4,
                                  }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {isStreaming
                                  ? "Midas está digitando..."
                                  : "Midas está pensando..."}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>

                {/* Image preview Mobile - No limite do chat */}
                {selectedImage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-3 pb-2"
                  >
                    <div className="rounded-lg border border-border bg-card/80 p-2 shadow-lg backdrop-blur-xl">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Image
                            src={URL.createObjectURL(selectedImage)}
                            alt="Preview"
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                          {isProcessingImage && (
                            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="truncate text-xs font-medium">
                            {selectedImage.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
                            {isProcessingImage && (
                              <span className="ml-2 text-blue-500">
                                • Processando...
                              </span>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedImage(null)}
                          disabled={isProcessingImage}
                          className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Error Display Mobile */}
                {error && (
                  <div className="px-3 pb-2">
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2">
                      <p className="text-xs text-red-500">{error}</p>
                      {error.includes("conexão") ||
                      error.includes("indisponível") ? (
                        <p className="mt-1 text-xs text-red-400">
                          💡 Dica: Tente novamente ou use uma das ações acima.
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Input Area Mobile */}
                <div className="relative z-[60] w-full max-w-full flex-shrink-0">
                  <motion.div
                    className="relative w-full max-w-full rounded-xl border border-border bg-card/80 shadow-lg backdrop-blur-xl"
                    initial={{ scale: 0.98 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    {/* Command Palette Mobile */}
                    <AnimatePresence>
                      {showCommandPalette && (
                        <motion.div
                          ref={commandPaletteRef}
                          className="absolute bottom-full left-3 right-3 z-50 mb-2 overflow-hidden rounded-lg border border-border bg-background/90 shadow-lg backdrop-blur-xl"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          transition={{ duration: 0.15 }}
                        >
                          <div className="bg-background py-1">
                            {commandSuggestions.map((suggestion, index) => (
                              <motion.div
                                key={suggestion.prefix}
                                className={cn(
                                  "flex cursor-pointer items-center gap-2 px-3 py-2 text-xs transition-colors",
                                  activeSuggestion === index
                                    ? "bg-primary/20 text-foreground"
                                    : "text-muted-foreground hover:bg-primary/10",
                                )}
                                onClick={() => selectCommandSuggestion(index)}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: index * 0.03 }}
                              >
                                <div className="flex h-4 w-4 items-center justify-center text-primary">
                                  {suggestion.icon}
                                </div>
                                <div className="font-medium">
                                  {suggestion.label}
                                </div>
                                <div className="ml-1 text-xs text-muted-foreground">
                                  {suggestion.prefix}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="w-full max-w-full p-3">
                      <Textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => {
                          setValue(e.target.value);
                          adjustHeight();
                        }}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setInputFocused(true)}
                        onBlur={() => setInputFocused(false)}
                        placeholder="Pergunte ao Midas..."
                        containerClassName="w-full max-w-full"
                        className={cn(
                          "w-full max-w-full px-3 py-2",
                          "resize-none",
                          "bg-transparent",
                          "border-none",
                          "text-xs text-foreground",
                          "focus:outline-none",
                          "placeholder:text-muted-foreground",
                          "min-h-[40px]",
                        )}
                        style={{
                          overflow: "hidden",
                          maxWidth: "100%",
                        }}
                        showRing={false}
                      />
                    </div>

                    {/* Audio recording section Mobile */}
                    <AnimatePresence>
                      {(isRecording || audioBlob || isProcessingAudio) && (
                        <motion.div
                          className="px-3 pb-2"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <div className="flex items-center gap-2 rounded-lg border border-border bg-primary/5 p-2">
                            <div className="flex items-center gap-2">
                              {isRecording ? (
                                <motion.div
                                  className="h-2 w-2 rounded-full bg-red-500"
                                  animate={{ scale: [1, 1.2, 1] }}
                                  transition={{
                                    duration: 0.8,
                                    repeat: Infinity,
                                  }}
                                />
                              ) : isProcessingAudio ? (
                                <motion.div
                                  className="h-2 w-2 rounded-full bg-blue-500"
                                  animate={{ scale: [1, 1.2, 1] }}
                                  transition={{
                                    duration: 0.8,
                                    repeat: Infinity,
                                  }}
                                />
                              ) : (
                                <div className="h-2 w-2 rounded-full bg-primary" />
                              )}
                              <span className="text-xs font-medium">
                                {isRecording
                                  ? "Gravando..."
                                  : isProcessingAudio
                                    ? "Processando..."
                                    : "Áudio gravado"}
                              </span>
                              {isRecording && (
                                <span className="text-xs text-muted-foreground">
                                  {formatTime(recordingTime)}
                                </span>
                              )}
                            </div>

                            <div className="ml-auto flex items-center gap-1">
                              {audioBlob &&
                                !isRecording &&
                                !isProcessingAudio && (
                                  <>
                                    <motion.button
                                      onClick={
                                        isPlaying ? pauseAudio : playAudio
                                      }
                                      whileTap={{ scale: 0.95 }}
                                      className="flex h-6 w-6 items-center justify-center rounded-full text-primary transition-colors hover:text-primary/80"
                                    >
                                      {isPlaying ? (
                                        <Square className="h-3 w-3" />
                                      ) : (
                                        <Play className="h-3 w-3" />
                                      )}
                                    </motion.button>

                                    {error && (
                                      <motion.button
                                        onClick={() => processAudio(audioBlob)}
                                        whileTap={{ scale: 0.95 }}
                                        className="flex h-6 w-6 items-center justify-center rounded-full text-blue-500 transition-colors hover:text-blue-600"
                                        title="Tentar novamente"
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                      </motion.button>
                                    )}

                                    <button
                                      onClick={clearAudio}
                                      className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                      <XIcon className="h-3 w-3" />
                                    </button>
                                  </>
                                )}

                              {isRecording && !isProcessingAudio && (
                                <motion.button
                                  onClick={stopRecording}
                                  whileTap={{ scale: 0.95 }}
                                  className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
                                >
                                  <Square className="h-3 w-3" />
                                </motion.button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex w-full max-w-full items-center justify-between gap-2 overflow-hidden border-t border-border p-3">
                      {/* Hidden file input for image upload */}
                      <input
                        id="image-upload-mobile"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleImageSelect(file);
                          }
                        }}
                        className="hidden"
                      />

                      <div className="flex items-center gap-2">
                        <motion.button
                          type="button"
                          onClick={() =>
                            document
                              .getElementById("image-upload-mobile")
                              ?.click()
                          }
                          whileTap={{ scale: 0.94 }}
                          className="group relative rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground sm:p-1.5"
                        >
                          <ImageIcon className="h-5 w-5 sm:h-4 sm:w-4" />
                        </motion.button>

                        <motion.button
                          type="button"
                          onClick={async () => {
                            if (isRecording) {
                              stopRecording();
                            } else {
                              // Verificar limite antes de iniciar gravação
                              const canSend = await checkAudioLimit();
                              if (!canSend) {
                                return;
                              }
                              startRecording();
                            }
                          }}
                          whileTap={{ scale: 0.94 }}
                          disabled={isProcessingAudio}
                          className={cn(
                            "group relative rounded-lg p-2 transition-colors sm:p-1.5",
                            isRecording
                              ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                              : isProcessingAudio
                                ? "cursor-not-allowed text-muted-foreground/50"
                                : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {isRecording ? (
                            <MicOff className="h-5 w-5 sm:h-4 sm:w-4" />
                          ) : (
                            <Mic className="h-5 w-5 sm:h-4 sm:w-4" />
                          )}
                        </motion.button>

                        {/* Botão Command para mobile */}
                        <motion.button
                          type="button"
                          data-command-button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowCommandPalette((prev) => !prev);
                          }}
                          whileTap={{ scale: 0.94 }}
                          className={cn(
                            "group relative rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground sm:p-1.5",
                            showCommandPalette &&
                              "bg-primary/20 text-foreground",
                          )}
                        >
                          <Command className="h-5 w-5 sm:h-4 sm:w-4" />
                        </motion.button>
                      </div>

                      <div className="flex items-center gap-1">
                        {messages.length > 0 && (
                          <motion.button
                            type="button"
                            onClick={clearMessages}
                            whileTap={{ scale: 0.95 }}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground sm:h-6 sm:w-6"
                            title="Limpar conversa"
                          >
                            <RotateCcw className="h-4 w-4 sm:h-3 sm:w-3" />
                          </motion.button>
                        )}

                        <motion.button
                          type="button"
                          onClick={handleSendMessage}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          disabled={
                            isLoading ||
                            isProcessingAudio ||
                            isProcessingImage ||
                            (!value.trim() && !audioBlob && !selectedImage)
                          }
                          className={cn(
                            "rounded-lg px-4 py-2.5 text-sm font-medium transition-all sm:px-4 sm:py-2",
                            "flex items-center gap-2",
                            value.trim() || audioBlob || selectedImage
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/10"
                              : "bg-muted/50 text-muted-foreground",
                          )}
                        >
                          {isLoading ||
                          isProcessingAudio ||
                          isProcessingImage ? (
                            <LoaderIcon className="h-4 w-4 animate-[spin_2s_linear_infinite]" />
                          ) : (
                            <SendIcon className="h-4 w-4" />
                          )}
                          <span className="hidden sm:inline">
                            {isProcessingAudio ? "Processando..." : "Enviar"}
                          </span>
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Desktop Layout - Com Chat */}
            <div className="relative z-10 hidden h-[calc(100vh-6rem)] flex-col overflow-hidden md:flex">
              {/* Cabeçalho da página - título */}
              <div className="flex-shrink-0 p-4 pb-2">
                <div className="mx-auto max-w-4xl">
                  <motion.div
                    className="space-y-2 text-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  >
                    <h1 className="text-2xl font-bold">Midas AI</h1>
                    <p className="text-muted-foreground">
                      Seu assistente financeiro inteligente
                    </p>
                  </motion.div>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-hidden">
                <div className="mx-auto h-full max-w-4xl">
                  <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card/80 shadow-2xl backdrop-blur-2xl">
                    <div
                      ref={desktopChatRef}
                      onScroll={() => handleScroll(desktopChatRef)}
                      className="chat-messages-desktop scrollbar-theme flex-1 space-y-2 overflow-y-auto p-3"
                    >
                      {messages.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-center">
                          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                            <Brain className="icon-shine h-8 w-8 text-primary" />
                          </div>
                          <h3 className="mb-2 text-lg font-semibold">
                            Seu assistente de IA em finanças
                          </h3>
                          <h1 className="mb-2 text-3xl font-semibold">
                            Como posso ajudar hoje?
                          </h1>
                          <p className="mb-6 max-w-md text-muted-foreground">
                            Digite um comando ou faça uma pergunta sobre suas
                            finanças...
                          </p>

                          {/* Sugestão única com rotação */}
                          <div className="w-full max-w-lg sm:max-w-md">
                            <p className="mb-4 text-base text-muted-foreground sm:mb-3 sm:text-sm">
                              Tente perguntar:
                            </p>
                            <div className="relative min-h-16 sm:min-h-12">
                              <AnimatePresence mode="wait">
                                <motion.button
                                  key={currentSuggestionIndex}
                                  onClick={async () => {
                                    const canSend = await checkMessageLimit();
                                    if (!canSend) {
                                      return;
                                    }
                                    sendMessage(
                                      suggestedPrompts[currentSuggestionIndex],
                                    );
                                  }}
                                  className="absolute inset-0 flex min-h-16 w-full items-center justify-center rounded-lg border border-border p-4 text-center text-base transition-colors hover:bg-muted/50 sm:min-h-12 sm:p-3 sm:text-sm"
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  transition={{ duration: 0.3 }}
                                >
                                  {suggestedPrompts[currentSuggestionIndex]}
                                </motion.button>
                              </AnimatePresence>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {messages.map((message, index) => (
                            <MessageBubble
                              key={message.id}
                              message={message}
                              isLast={index === messages.length - 1}
                            />
                          ))}

                          {isLoading && (
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mb-2 flex gap-2"
                            >
                              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                                <Brain className="icon-shine h-4 w-4 text-primary" />
                              </div>
                              <div className="rounded-xl bg-muted px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex space-x-1">
                                    <motion.div
                                      className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                                      animate={{ opacity: [0.3, 1, 0.3] }}
                                      transition={{
                                        duration: 1,
                                        repeat: Infinity,
                                        delay: 0,
                                      }}
                                    />
                                    <motion.div
                                      className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                                      animate={{ opacity: [0.3, 1, 0.3] }}
                                      transition={{
                                        duration: 1,
                                        repeat: Infinity,
                                        delay: 0.2,
                                      }}
                                    />
                                    <motion.div
                                      className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                                      animate={{ opacity: [0.3, 1, 0.3] }}
                                      transition={{
                                        duration: 1,
                                        repeat: Infinity,
                                        delay: 0.4,
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {isStreaming
                                      ? "Midas está digitando..."
                                      : "Midas está pensando..."}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Error Display */}
                    {error && (
                      <div className="px-4 pb-2">
                        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                          <p className="text-sm text-red-500">{error}</p>
                          {error.includes("conexão") ||
                          error.includes("indisponível") ? (
                            <p className="mt-1 text-xs text-red-400">
                              💡 Dica: Você pode tentar gravar novamente ou
                              digitar sua mensagem.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    )}

                    {/* Input Area */}
                    <div className="relative z-[60] flex-shrink-0">
                      <motion.div
                        className="relative rounded-2xl border border-border bg-card/80 shadow-2xl backdrop-blur-2xl"
                        initial={{ scale: 0.98 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        <AnimatePresence>
                          {showCommandPalette && (
                            <motion.div
                              ref={commandPaletteRef}
                              className="absolute bottom-full left-4 right-4 z-50 mb-2 overflow-hidden rounded-lg border border-border bg-background/90 shadow-lg backdrop-blur-xl"
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 5 }}
                              transition={{ duration: 0.15 }}
                            >
                              <div className="bg-background py-1">
                                {commandSuggestions.map((suggestion, index) => (
                                  <motion.div
                                    key={suggestion.prefix}
                                    className={cn(
                                      "flex cursor-pointer items-center gap-2 px-3 py-2 text-xs transition-colors",
                                      activeSuggestion === index
                                        ? "bg-primary/20 text-foreground"
                                        : "text-muted-foreground hover:bg-primary/10",
                                    )}
                                    onClick={() =>
                                      selectCommandSuggestion(index)
                                    }
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: index * 0.03 }}
                                  >
                                    <div className="flex h-5 w-5 items-center justify-center text-primary">
                                      {suggestion.icon}
                                    </div>
                                    <div className="font-medium">
                                      {suggestion.label}
                                    </div>
                                    <div className="ml-1 text-xs text-muted-foreground">
                                      {suggestion.prefix}
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="p-4">
                          <Textarea
                            ref={textareaRef}
                            value={value}
                            onChange={(e) => {
                              setValue(e.target.value);
                              adjustHeight();
                            }}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setInputFocused(true)}
                            onBlur={() => setInputFocused(false)}
                            placeholder="Pergunte ao Midas sobre suas finanças..."
                            containerClassName="w-full"
                            className={cn(
                              "w-full px-4 py-3",
                              "resize-none",
                              "bg-transparent",
                              "border-none",
                              "text-sm text-foreground",
                              "focus:outline-none",
                              "placeholder:text-muted-foreground",
                              "min-h-[60px]",
                            )}
                            style={{
                              overflow: "hidden",
                            }}
                            showRing={false}
                          />
                        </div>

                        {/* Audio recording section */}
                        <AnimatePresence>
                          {(isRecording || audioBlob || isProcessingAudio) && (
                            <motion.div
                              className="px-4 pb-3"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                            >
                              <div className="flex items-center gap-3 rounded-lg border border-border bg-primary/5 p-3">
                                <div className="flex items-center gap-2">
                                  {isRecording ? (
                                    <motion.div
                                      className="h-3 w-3 rounded-full bg-red-500"
                                      animate={{ scale: [1, 1.2, 1] }}
                                      transition={{
                                        duration: 0.8,
                                        repeat: Infinity,
                                      }}
                                    />
                                  ) : isProcessingAudio ? (
                                    <motion.div
                                      className="h-3 w-3 rounded-full bg-blue-500"
                                      animate={{ scale: [1, 1.2, 1] }}
                                      transition={{
                                        duration: 0.8,
                                        repeat: Infinity,
                                      }}
                                    />
                                  ) : (
                                    <div className="h-3 w-3 rounded-full bg-primary" />
                                  )}
                                  <span className="text-sm font-medium">
                                    {isRecording
                                      ? "Gravando..."
                                      : isProcessingAudio
                                        ? "Processando áudio..."
                                        : "Áudio gravado"}
                                  </span>
                                  {isRecording && (
                                    <span className="text-xs text-muted-foreground">
                                      {formatTime(recordingTime)}
                                    </span>
                                  )}
                                </div>

                                <div className="ml-auto flex items-center gap-2">
                                  {audioBlob &&
                                    !isRecording &&
                                    !isProcessingAudio && (
                                      <>
                                        <motion.button
                                          onClick={
                                            isPlaying ? pauseAudio : playAudio
                                          }
                                          whileTap={{ scale: 0.95 }}
                                          className="flex h-8 w-8 items-center justify-center rounded-full text-primary transition-colors hover:text-primary/80"
                                        >
                                          {isPlaying ? (
                                            <Square className="h-4 w-4" />
                                          ) : (
                                            <Play className="h-4 w-4" />
                                          )}
                                        </motion.button>

                                        {/* Botão para tentar novamente se houve erro */}
                                        {error && (
                                          <motion.button
                                            onClick={() =>
                                              processAudio(audioBlob)
                                            }
                                            whileTap={{ scale: 0.95 }}
                                            className="flex h-8 w-8 items-center justify-center rounded-full text-blue-500 transition-colors hover:text-blue-600"
                                            title="Tentar novamente"
                                          >
                                            <RotateCcw className="h-4 w-4" />
                                          </motion.button>
                                        )}

                                        <button
                                          onClick={clearAudio}
                                          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                                        >
                                          <XIcon className="h-4 w-4" />
                                        </button>
                                      </>
                                    )}

                                  {isRecording && !isProcessingAudio && (
                                    <motion.button
                                      onClick={stopRecording}
                                      whileTap={{ scale: 0.95 }}
                                      className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
                                    >
                                      <Square className="h-4 w-4" />
                                    </motion.button>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Image preview */}
                        {selectedImage && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="border-t border-border p-4"
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <Image
                                  src={URL.createObjectURL(selectedImage)}
                                  alt="Preview"
                                  width={64}
                                  height={64}
                                  className="h-16 w-16 rounded-lg object-cover"
                                />
                                {isProcessingImage && (
                                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium">
                                  {selectedImage.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {(selectedImage.size / 1024 / 1024).toFixed(
                                    2,
                                  )}{" "}
                                  MB
                                  {isProcessingImage && (
                                    <span className="ml-2 text-blue-500">
                                      • Processando...
                                    </span>
                                  )}
                                </p>
                              </div>
                              <button
                                onClick={() => setSelectedImage(null)}
                                disabled={isProcessingImage}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                              >
                                <XIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </motion.div>
                        )}

                        <div className="flex items-center justify-between gap-4 border-t border-border p-4">
                          {/* Hidden file input for image upload */}
                          <input
                            id="image-upload"
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleImageSelect(file);
                              }
                            }}
                            className="hidden"
                          />

                          <div className="flex items-center gap-3">
                            <div className="image-options-menu relative">
                              <motion.button
                                type="button"
                                onClick={() =>
                                  setShowImageOptions(!showImageOptions)
                                }
                                whileTap={{ scale: 0.94 }}
                                className="group relative rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground"
                              >
                                <ImageIcon className="h-4 w-4" />
                                <motion.span
                                  className="absolute inset-0 rounded-lg bg-primary/10 opacity-0 transition-opacity group-hover:opacity-100"
                                  layoutId="button-highlight"
                                />
                              </motion.button>

                              {/* Menu de opções de imagem */}
                              <AnimatePresence>
                                {showImageOptions && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                    className="absolute bottom-full left-0 z-50 mb-2 w-48 rounded-lg border bg-background p-2 shadow-lg"
                                  >
                                    <motion.button
                                      onClick={() => {
                                        handleGallerySelect();
                                        setShowImageOptions(false);
                                      }}
                                      whileTap={{ scale: 0.98 }}
                                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                                    >
                                      <FolderOpen className="h-4 w-4 text-blue-500" />
                                      <span>Escolher da galeria</span>
                                    </motion.button>

                                    <motion.button
                                      onClick={async () => {
                                        // Verificar limite antes de abrir câmera
                                        const canSend = await checkImageLimit();
                                        if (!canSend) {
                                          setShowImageOptions(false);
                                          return;
                                        }

                                        setShowCameraCapture(true);
                                        setShowImageOptions(false);
                                      }}
                                      whileTap={{ scale: 0.98 }}
                                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                                    >
                                      <Camera className="h-4 w-4 text-green-500" />
                                      <span>Tirar foto</span>
                                    </motion.button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            <motion.button
                              type="button"
                              onClick={async () => {
                                if (isRecording) {
                                  stopRecording();
                                } else {
                                  // Verificar limite antes de iniciar gravação
                                  const canSend = await checkAudioLimit();
                                  if (!canSend) {
                                    return;
                                  }
                                  startRecording();
                                }
                              }}
                              whileTap={{ scale: 0.94 }}
                              disabled={isProcessingAudio}
                              className={cn(
                                "group relative rounded-lg p-2 transition-colors",
                                isRecording
                                  ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                                  : isProcessingAudio
                                    ? "cursor-not-allowed text-muted-foreground/50"
                                    : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {isRecording ? (
                                <MicOff className="h-4 w-4" />
                              ) : (
                                <Mic className="h-4 w-4" />
                              )}
                              <motion.span
                                className="absolute inset-0 rounded-lg bg-primary/10 opacity-0 transition-opacity group-hover:opacity-100"
                                layoutId="button-highlight"
                              />
                            </motion.button>
                          </div>

                          <div className="flex items-center gap-2">
                            {messages.length > 0 && (
                              <motion.button
                                type="button"
                                onClick={clearMessages}
                                whileTap={{ scale: 0.95 }}
                                className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground sm:h-8 sm:w-8"
                                title="Limpar conversa"
                              >
                                <RotateCcw className="h-5 w-5 sm:h-4 sm:w-4" />
                              </motion.button>
                            )}

                            <motion.button
                              type="button"
                              onClick={handleSendMessage}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.98 }}
                              disabled={
                                isLoading ||
                                isProcessingAudio ||
                                isProcessingImage ||
                                (!value.trim() && !audioBlob && !selectedImage)
                              }
                              className={cn(
                                "rounded-lg px-3 py-2 text-sm font-medium transition-all sm:px-4 sm:py-2",
                                "flex items-center gap-2",
                                value.trim() || audioBlob || selectedImage
                                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/10"
                                  : "bg-muted/50 text-muted-foreground",
                              )}
                            >
                              {isLoading ||
                              isProcessingAudio ||
                              isProcessingImage ? (
                                <LoaderIcon className="h-4 w-4 animate-[spin_2s_linear_infinite]" />
                              ) : (
                                <SendIcon className="h-4 w-4" />
                              )}
                              <span>
                                {isProcessingAudio
                                  ? "Processando áudio..."
                                  : "Enviar"}
                              </span>
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Command Suggestions - Apenas no desktop */}
              <div className="flex-shrink-0 p-4 pt-2">
                <div className="mx-auto max-w-4xl">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {commandSuggestions.map((suggestion, index) => (
                      <motion.button
                        key={suggestion.prefix}
                        onClick={() => selectCommandSuggestion(index)}
                        className="group relative flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-primary/10 hover:text-foreground"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        {suggestion.icon}
                        <span>{suggestion.label}</span>
                        <motion.div
                          className="absolute inset-0 rounded-lg border border-border/50"
                          initial={false}
                          animate={{
                            opacity: [0, 1],
                            scale: [0.98, 1],
                          }}
                          transition={{
                            duration: 0.3,
                            ease: "easeOut",
                          }}
                        />
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {inputFocused && (
              <motion.div
                className="pointer-events-none fixed z-0 h-[50rem] w-[50rem] rounded-full bg-gradient-to-r from-primary via-primary/80 to-secondary opacity-[0.02] blur-[96px]"
                animate={{
                  x: mousePosition.x - 400,
                  y: mousePosition.y - 400,
                }}
                transition={{
                  type: "spring",
                  damping: 25,
                  stiffness: 150,
                  mass: 0.5,
                }}
              />
            )}
          </div>
        </div>
      </PremiumGate>

      {/* Transaction Dialog */}
      <UpsertTransactionDialog
        isOpen={transactionDialogOpen}
        setIsOpen={setTransactionDialogOpen}
        defaultValues={
          transactionData
            ? {
                name: transactionData.name || "",
                amount: transactionData.amount || 0,
                category: transactionData.category,
                paymentMethod: transactionData.paymentMethod,
                type: transactionData.type,
                date: transactionData.date || new Date(),
              }
            : undefined
        }
      />

      {/* Camera Capture Modal */}
      <AnimatePresence>
        {showCameraCapture && (
          <CameraCapture
            onCapture={handleCameraCapture}
            onClose={() => setShowCameraCapture(false)}
          />
        )}
      </AnimatePresence>

      {/* Modal de Limite */}
      <AnimatePresence>
        {showLimitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <LimitReachedGate
              limitType={limitType as any}
              currentUsage={0}
              limit={0}
              plan="Start"
            >
              <div />
            </LimitReachedGate>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const rippleKeyframes = `
@keyframes ripple {
  0% { transform: scale(0.5); opacity: 0.6; }
  100% { transform: scale(2); opacity: 0; }
}
`;

if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = rippleKeyframes;
  document.head.appendChild(style);
}
