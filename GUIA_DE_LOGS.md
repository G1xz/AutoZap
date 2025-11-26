# 🔍 Guia de Logs - Como Identificar Problemas

## 📋 Logs Importantes para Debug

Quando você reportar um problema, procure por estes logs específicos:

### 1. 🚨 **PROBLEMA: Agendamento não está sendo criado**

Procure por estes logs na ordem:

1. **`[generateAIResponse] CHAMANDO OPENAI`**
   - Deve mostrar quantas mensagens estão no histórico
   - Deve mostrar quais funções estão disponíveis (deve incluir `create_appointment`)

2. **`[generateAIResponse] RESPOSTA RECEBIDA DA OPENAI`**
   - Se mostrar `IA quer chamar função? ✅ SIM` → A IA está tentando criar agendamento
   - Se mostrar `IA quer chamar função? ❌ NÃO` → A IA não está chamando a função (problema no prompt ou na IA)

3. **`[generateAIResponse] EXECUTANDO FUNÇÃO`**
   - Deve mostrar o nome da função (`create_appointment`)
   - Deve mostrar os argumentos (date, time, description)

4. **`[handleFunctionCall] Tentando criar agendamento`**
   - Deve mostrar os dados que estão sendo processados
   - Se houver erro aqui, será mostrado claramente

5. **`[handleFunctionCall] CRIANDO AGENDAMENTO PENDENTE`**
   - Deve mostrar que o agendamento pendente foi criado
   - Deve mostrar a verificação se foi salvo no banco

### 2. 🚨 **PROBLEMA: Agendamento pendente não é encontrado na confirmação**

Procure por estes logs:

1. **`[processAppointmentConfirmation] INICIANDO PROCESSAMENTO`**
   - Deve mostrar o `contactNumber` original e normalizado
   - Deve mostrar a mensagem do usuário

2. **`[processAppointmentConfirmation] Buscando agendamento pendente...`**
   - Deve mostrar os parâmetros de busca (instanceId, contactNumber)
   - Deve mostrar se encontrou ou não

3. **`[processAppointmentConfirmation] Resultado da busca:`**
   - Se mostrar `✅ ENCONTRADO` → Tudo certo, deve continuar
   - Se mostrar `❌ NÃO ENCONTRADO` → Problema! Verifique:
     - O número de telefone está correto?
     - O `instanceId` está correto?
     - O agendamento foi criado antes?

### 3. 🚨 **PROBLEMA: IA não está respondendo ou está confusa**

Procure por estes logs:

1. **`[executeAIOnlyWorkflow] Continuando com processamento normal da IA`**
   - Deve aparecer quando a IA vai responder

2. **`[generateAIResponse] CHAMANDO OPENAI`**
   - Deve mostrar a mensagem do usuário
   - Deve mostrar as funções disponíveis

3. **`[generateAIResponse] RESPOSTA RECEBIDA DA OPENAI`**
   - Se mostrar resposta de texto → A IA respondeu normalmente
   - Se mostrar função call → A IA quer executar uma ação

## 📝 Como Enviar os Logs

Quando reportar um problema, envie:

1. **A mensagem que você enviou** (ex: "quero agendar um confronto para amanhã 3 da tarde")

2. **Os logs desde o início da requisição** até o final, procurando por:
   - `[processIncomingMessage]` - início do processamento
   - `[executeWorkflows]` - início dos workflows
   - `[executeAIOnlyWorkflow]` - início do workflow IA
   - `[generateAIResponse]` - chamadas à IA
   - `[handleFunctionCall]` - execução de funções
   - `[processAppointmentConfirmation]` - confirmação de agendamento

3. **Qualquer erro em vermelho** (começando com `❌`)

## 🎯 Logs Mais Importantes (em ordem de prioridade)

1. **`[processAppointmentConfirmation]`** - Se você está tentando confirmar um agendamento
2. **`[handleFunctionCall]`** - Se você está tentando criar um agendamento
3. **`[generateAIResponse]`** - Se a IA não está respondendo corretamente
4. **`[executeAIOnlyWorkflow]`** - Se o workflow não está iniciando

## 💡 Dica

Use `Ctrl+F` (ou `Cmd+F` no Mac) no console para procurar por:
- `❌` - Erros
- `⚠️` - Avisos
- `✅` - Sucessos
- O nome da função que você espera que seja chamada (ex: `create_appointment`)

