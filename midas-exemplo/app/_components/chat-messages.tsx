"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/app/_lib/utils";
import { User, Brain, Copy, Check } from "lucide-react";
import { ChatMessage } from "@/app/_hooks/useChat";
import { useUser } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Image from "next/image";

interface MessageBubbleProps {
  message: ChatMessage;
  isLast?: boolean;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const { user } = useUser();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset após 2 segundos
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "mb-2 flex gap-2",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground",
        )}
      >
        {isUser ? (
          user?.imageUrl ? (
            <Image
              src={user.imageUrl}
              alt="User avatar"
              width={32}
              height={32}
              className="h-full w-full object-cover"
            />
          ) : (
            <User className="h-4 w-4" />
          )
        ) : (
          <Brain className="icon-shine h-4 w-4 text-primary" />
        )}
      </div>

      {/* Message content */}
      <div
        className={cn(
          "max-w-[80%] flex-1",
          isUser ? "flex justify-end" : "flex justify-start",
        )}
      >
        <div
          className={cn(
            "group relative rounded-xl px-3 py-2 text-xs",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground",
          )}
        >
          {/* Image content */}
          {message.imageUrl && (
            <div className="mb-2">
              <Image
                src={message.imageUrl}
                alt="Uploaded image"
                width={200}
                height={150}
                className="h-auto max-w-full rounded-lg object-cover"
              />
            </div>
          )}

          {/* Text content */}
          {message.content && (
            <div className="prose prose-sm max-w-none break-words prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-em:text-foreground prose-li:text-foreground">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Customizar componentes para melhor integração com o tema
                  h1: ({ children }) => (
                    <h1 className="mb-2 text-lg font-bold text-foreground">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="mb-2 text-base font-semibold text-foreground">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="mb-1 text-sm font-semibold text-foreground">
                      {children}
                    </h3>
                  ),
                  h4: ({ children }) => (
                    <h4 className="mb-1 text-sm font-medium text-foreground">
                      {children}
                    </h4>
                  ),
                  h5: ({ children }) => (
                    <h5 className="mb-1 text-xs font-medium text-foreground">
                      {children}
                    </h5>
                  ),
                  h6: ({ children }) => (
                    <h6 className="mb-1 text-xs font-medium text-foreground">
                      {children}
                    </h6>
                  ),
                  p: ({ children }) => (
                    <p className="mb-2 text-foreground">{children}</p>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-foreground">
                      {children}
                    </strong>
                  ),
                  em: ({ children }) => (
                    <em className="italic text-foreground">{children}</em>
                  ),
                  ul: ({ children }) => (
                    <ul className="mb-2 list-inside list-disc space-y-1 text-foreground">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="mb-2 list-inside list-decimal space-y-1 text-foreground">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-foreground">{children}</li>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="mb-2 border-l-4 border-primary pl-4 italic text-muted-foreground">
                      {children}
                    </blockquote>
                  ),
                  code: ({ children }) => (
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre className="mb-2 overflow-x-auto rounded bg-muted p-2 font-mono text-xs text-foreground">
                      {children}
                    </pre>
                  ),
                  table: ({ children }) => (
                    <div className="mb-2 overflow-x-auto">
                      <table className="min-w-full border-collapse border border-border">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-muted">{children}</thead>
                  ),
                  tbody: ({ children }) => <tbody>{children}</tbody>,
                  tr: ({ children }) => (
                    <tr className="border-b border-border">{children}</tr>
                  ),
                  th: ({ children }) => (
                    <th className="border border-border px-2 py-1 text-left font-semibold text-foreground">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-border px-2 py-1 text-foreground">
                      {children}
                    </td>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Timestamp e botão de copiar */}
          <div className="mt-1 flex items-center justify-between">
            <div
              className={cn(
                "text-xs opacity-60",
                isUser ? "text-primary-foreground/60" : "text-muted-foreground",
              )}
            >
              {message.timestamp.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>

            {/* Botão de copiar - apenas para mensagens do assistente */}
            {!isUser && message.content && (
              <motion.button
                onClick={handleCopy}
                className={cn(
                  "rounded-md p-1 transition-all duration-200",
                  "hover:scale-105 hover:bg-background/80",
                  // Sempre visível em mobile, hover em desktop
                  "md:opacity-0 md:group-hover:opacity-100",
                  copied
                    ? "bg-green-500/20 text-green-600"
                    : "bg-background/60 text-muted-foreground hover:text-foreground",
                )}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title={copied ? "Copiado!" : "Copiar mensagem"}
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming?: boolean;
  onSuggestedPrompt?: (prompt: string) => void;
}

export function ChatMessages({
  messages,
  isLoading,
  isStreaming,
  onSuggestedPrompt,
}: ChatMessagesProps) {
  const suggestedPrompts = [
    "Gere um relatório completo da minha situação financeira",
    "Analise meus gastos por categoria este mês",
    "Como posso economizar mais dinheiro?",
    "Qual é a tendência dos meus gastos?",
    "Me dê sugestões de investimento baseadas no meu perfil",
    "Compare meus gastos deste mês com o anterior",
    "Identifique padrões nos meus gastos",
    "Quais são minhas maiores despesas?",
  ];

  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);

  // Auto-scroll quando há novas mensagens ou quando está carregando/streaming
  useEffect(() => {
    if (scrollContainerRef.current && !userScrolled) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading, isStreaming, userScrolled]);

  // Detectar se o usuário fez scroll manual
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        scrollContainerRef.current;
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

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
    >
      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Brain className="icon-shine h-8 w-8 text-primary" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">
            Seu assistente de IA em finanças
          </h3>
          <p className="mb-6 max-w-md text-muted-foreground">
            Seu assistente de IA especializado em finanças pessoais. Posso
            analisar seus dados financeiros e gerar relatórios personalizados!
          </p>

          {/* Sugestão única com rotação */}
          <div className="w-full max-w-md">
            <p className="mb-3 text-sm text-muted-foreground">
              Tente perguntar:
            </p>
            <div className="relative h-12">
              <AnimatePresence mode="wait">
                <motion.button
                  key={currentSuggestionIndex}
                  onClick={() =>
                    onSuggestedPrompt?.(
                      suggestedPrompts[currentSuggestionIndex],
                    )
                  }
                  className="absolute inset-0 w-full rounded-lg border border-border p-3 text-left text-sm transition-colors hover:bg-muted/50"
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
        <>
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
              className="mb-4 flex gap-3"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <Brain className="icon-shine h-4 w-4 text-primary" />
              </div>
              <div className="rounded-2xl bg-muted px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    <motion.div
                      className="h-2 w-2 rounded-full bg-muted-foreground"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                    />
                    <motion.div
                      className="h-2 w-2 rounded-full bg-muted-foreground"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                    />
                    <motion.div
                      className="h-2 w-2 rounded-full bg-muted-foreground"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Midas está pensando...
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
