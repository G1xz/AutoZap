# Guia de Teste - Otimizações de Performance

## 📋 Funções Modificadas

### 1. `getPendingAppointment` (lib/pending-appointments.ts)
**O que faz:** Busca agendamentos pendentes no banco de dados

**O que mudou:**
- ✅ Removidas 2 queries de debug desnecessárias
- ✅ Reduzidos logs excessivos
- ✅ Mantida funcionalidade de busca com formatos alternativos de número

**Onde é usado:**
- `processAppointmentConfirmation` - quando usuário confirma/cancela agendamento
- `handleFunctionCall` - quando IA tenta criar agendamento (verifica se já existe)

---

### 2. `processAppointmentConfirmation` (lib/workflow-executor.ts)
**O que faz:** Processa confirmação ou cancelamento de agendamentos pendentes

**O que mudou:**
- ✅ Reduzido de 5 tentativas para 2 tentativas
- ✅ Delay reduzido de 200ms * attempt para 100ms fixo
- ✅ Mantida funcionalidade completa

**Onde é usado:**
- `executeWorkflows` - chamado ANTES de processar workflows
- `processIncomingMessage` - chamado quando mensagem chega via webhook

---

### 3. `handleFunctionCall` (dentro de executeAIOnlyWorkflow)
**O que faz:** Processa chamadas de funções da IA (ex: create_appointment)

**O que mudou:**
- ✅ Reduzido de 5 tentativas para 2 tentativas na verificação após criar agendamento
- ✅ Delay reduzido de 200ms * attempt para 50ms fixo

**Onde é usado:**
- Quando a IA chama a função `create_appointment`

---

### 4. `executeAIOnlyWorkflow` (lib/workflow-executor.ts)
**O que faz:** Executa workflow IA-only e processa mensagens do usuário

**O que mudou:**
- ✅ Removida chamada duplicada de `processAppointmentConfirmation`
- ✅ Agora confia na chamada já feita em `executeWorkflows`

**Onde é usado:**
- `executeWorkflows` - quando há workflow IA-only ativo

---

## 🧪 Cenários de Teste

### ✅ Teste 1: Criar Agendamento Normal
**Passos:**
1. Enviar mensagem: "quero agendar um corte para amanhã às 14h"
2. Aguardar resposta da IA
3. Verificar se agendamento pendente foi criado

**O que verificar:**
- ✅ IA responde corretamente
- ✅ Agendamento pendente é criado
- ✅ Resposta chega mais rápido que antes (~15-25s em vez de 1min+)

---

### ✅ Teste 2: Confirmar Agendamento Pendente
**Passos:**
1. Criar um agendamento pendente (Teste 1)
2. Enviar mensagem: "confirmar"
3. Verificar se agendamento foi confirmado

**O que verificar:**
- ✅ Sistema encontra o agendamento pendente
- ✅ Agendamento é confirmado e criado no banco
- ✅ Agendamento pendente é removido
- ✅ Resposta chega rapidamente (~5-10s)

---

### ✅ Teste 3: Cancelar Agendamento Pendente
**Passos:**
1. Criar um agendamento pendente (Teste 1)
2. Enviar mensagem: "cancelar"
3. Verificar se agendamento foi cancelado

**O que verificar:**
- ✅ Sistema encontra o agendamento pendente
- ✅ Agendamento pendente é removido
- ✅ Mensagem de cancelamento é enviada

---

### ✅ Teste 4: Tentar Criar Agendamento Quando Já Existe Pendente
**Passos:**
1. Criar um agendamento pendente (Teste 1)
2. Tentar criar outro agendamento: "quero agendar uma barba para depois de amanhã"
3. Verificar comportamento

**O que verificar:**
- ✅ Sistema detecta agendamento pendente existente
- ✅ IA informa sobre o agendamento pendente
- ✅ Não cria novo agendamento pendente

---

### ✅ Teste 5: Mensagem Normal (Sem Agendamento)
**Passos:**
1. Enviar mensagem normal: "olá" ou "quais serviços vocês têm?"
2. Verificar resposta

**O que verificar:**
- ✅ Sistema processa normalmente
- ✅ IA responde corretamente
- ✅ Não há erros relacionados a agendamentos

---

### ✅ Teste 6: Múltiplas Mensagens Rápidas
**Passos:**
1. Enviar mensagem: "quero agendar"
2. Imediatamente enviar: "confirmar" (antes da primeira resposta)
3. Verificar comportamento

**O que verificar:**
- ✅ Sistema não quebra
- ✅ Ambas as mensagens são processadas
- ✅ Não há race conditions

---

### ✅ Teste 7: Números de Telefone em Diferentes Formatos
**Passos:**
1. Criar agendamento com número: "5511999999999"
2. Tentar confirmar com número: "11999999999" (sem código país)
3. Verificar se encontra o agendamento

**O que verificar:**
- ✅ Sistema normaliza números corretamente
- ✅ Encontra agendamento mesmo com formato diferente
- ✅ Confirmação funciona

---

## ⚠️ Pontos Críticos a Observar

### 1. Performance
- **Antes:** Mensagens complexas levavam 1min+ 
- **Depois:** Devem levar ~15-25s
- **Se demorar mais que 30s:** Pode haver problema

### 2. Funcionalidade
- **Agendamentos devem funcionar normalmente**
- **Confirmações devem funcionar**
- **Cancelamentos devem funcionar**

### 3. Logs
- **Menos logs no console** (otimização)
- **Logs importantes ainda aparecem**
- **Se não aparecer nenhum log:** Pode ser problema

---

## 🔍 Como Verificar se Está Funcionando

### ✅ Sinais de Sucesso:
1. Respostas mais rápidas (~15-25s em vez de 1min+)
2. Agendamentos funcionam normalmente
3. Confirmações funcionam
4. Cancelamentos funcionam
5. Sem erros no console

### ❌ Sinais de Problema:
1. Respostas muito lentas (>30s)
2. Agendamentos não são criados
3. Confirmações não funcionam
4. Erros no console relacionados a `getPendingAppointment` ou `processAppointmentConfirmation`
5. Mensagens duplicadas

---

## 📝 Checklist Rápido

- [ ] Criar agendamento funciona
- [ ] Confirmar agendamento funciona
- [ ] Cancelar agendamento funciona
- [ ] Mensagens normais funcionam
- [ ] Respostas estão mais rápidas
- [ ] Não há erros no console
- [ ] Sistema não quebra com múltiplas mensagens rápidas

---

## 🆘 Se Algo Quebrar

**Reverter as mudanças:**
1. As alterações foram apenas otimizações
2. Funcionalidade core não foi alterada
3. Se houver problema, pode ser relacionado a:
   - Race conditions (muito raro agora com 2 tentativas)
   - Formato de número de telefone
   - Timing de confirmação muito rápido

**Logs para debug:**
- Procurar por `[getPendingAppointment]`
- Procurar por `[processAppointmentConfirmation]`
- Procurar por `[handleFunctionCall]`











