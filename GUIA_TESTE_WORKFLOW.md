# 🧪 Guia de Teste - Workflows

## ✅ Status do Sistema

O sistema de workflows já está **100% integrado** com o WhatsApp! Quando você recebe uma mensagem, o sistema:
1. Processa a mensagem via webhook
2. Busca workflows ativos
3. Verifica se a mensagem contém o trigger
4. Executa o workflow automaticamente

## 📋 Como Testar

### 1. Criar um Workflow Simples

1. Acesse **Dashboard > Fluxos Visuais**
2. Clique em **"Novo Fluxo"**
3. Preencha:
   - **Nome**: "Teste Básico"
   - **Trigger**: "olá" (palavra-chave que inicia o fluxo)
4. Clique com botão direito no canvas e adicione um nó **💬 Mensagem**
5. Edite a mensagem (ex: "Olá! Como posso ajudar?")
6. Conecte o nó trigger ao nó de mensagem (arraste do conector)
7. Clique em **"Salvar Fluxo"**

### 2. Testar no WhatsApp

1. Abra seu WhatsApp
2. Envie a mensagem que contém o trigger: **"olá"**
3. O sistema deve responder automaticamente com a mensagem configurada!

## 🎯 Tipos de Nós Disponíveis

- **🚀 Trigger**: Nó inicial (automático)
- **💬 Mensagem**: Envia mensagem de texto
- **⏱️ Aguardar**: Pausa por X segundos/minutos/horas
- **❓ Questionário**: Envia pergunta e aguarda resposta
- **🤖 IA**: Integração com IA (em desenvolvimento)
- **🔀 Condição**: Executa caminhos diferentes baseado em condição

## 🔍 Verificar Logs

Os logs do sistema mostram:
- `🔄 Workflow "Nome" acionado para [número]`
- `▶️ Executando nó: [tipo] ([id])`
- `📨 Webhook recebido`
- `📬 Mensagens recebidas`

## ⚠️ Observações Importantes

1. **Trigger**: O sistema busca a palavra-chave dentro da mensagem (case-insensitive)
2. **Workflows Globais**: Se você não associar uma instância, o workflow funciona para todas
3. **Workflows por Instância**: Você pode criar workflows específicos para cada instância WhatsApp
4. **Status**: O workflow precisa estar **Ativo** para funcionar

## 🐛 Troubleshooting

### Workflow não executa?
- Verifique se o workflow está **Ativo**
- Confirme que o trigger está correto (sem acentos, case-insensitive)
- Verifique os logs do servidor para ver se o webhook está recebendo mensagens

### Mensagem não aparece?
- Verifique se a instância WhatsApp está conectada
- Confirme que o número está na lista de destinatários permitidos (modo teste)
- Veja os logs do servidor para erros de API

## 📝 Exemplo de Workflow Completo

1. **Trigger**: "oi"
2. **Mensagem**: "Olá! Seja bem-vindo! 😊"
3. **Questionário**: 
   - Pergunta: "Como você prefere ser atendido?"
   - Opções:
     - "1. WhatsApp"
     - "2. Email"
     - "3. Telefone"
4. **Condição**: Se resposta = "1", vai para mensagem de WhatsApp
5. **Mensagem Final**: "Perfeito! Vou te ajudar pelo WhatsApp."

---

**Pronto para testar!** 🚀

