import React from "react";
import { Button } from "@/app/_components/ui/button";
import { motion } from "framer-motion";
import { Brain } from "lucide-react";

interface MidasIntroProps {
  onContinue: () => void;
  onSkip: () => void;
}

export default function MidasIntro({ onContinue, onSkip }: MidasIntroProps) {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full"
        >
          <Brain className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </motion.div>

        <h2 className="mb-4 text-2xl font-bold bg-gradient-to-r from-yellow-500 to-amber-600 bg-clip-text text-transparent">
          Midas, sua IA financeira
        </h2>
        
        <p className="mb-8 text-lg leading-relaxed text-gray-600 dark:text-gray-400">
          Adicione transações por voz ou imagem e receba relatórios personalizados.
        </p>

        {/* Botões */}
        <div className="space-y-3">
          <Button 
            onClick={onContinue} 
            variant="outline"
            className="w-full text-amber-600 hover:bg-amber-50 hover:text-amber-700"
            size="lg"
          >
            Quero experimentar o Midas
          </Button>
          
          <Button 
            onClick={onSkip} 
            variant="ghost" 
            className="w-full text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            size="lg"
          >
            Pular e criar conta
          </Button>
        </div>
      </motion.div>
    </div>
  );
}