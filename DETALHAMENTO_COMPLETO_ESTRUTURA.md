# 📋 DETALHAMENTO COMPLETO DA ESTRUTURA DO SISTEMA

## 📌 VISÃO GERAL

Este documento fornece um detalhamento completo e detalhado de como está estruturado o sistema de **Chat**, **Carrinho**, **Agendamento** e **Pedidos** no projeto.

**Arquitetura Base:**
- Sistema baseado em `instanceId` + `contactNumber` (identificação única por instância WhatsApp)
- Integração com IA conversacional via OpenAI GPT
- Persistência no banco de dados PostgreSQL via Prisma ORM
- Validações robustas e tratamento de erros em todas as camadas

---

## 💬 ESTRUTURA DO CHAT

### 🗄️ Modelos de Dados (Prisma)

#### 1. **Message (Mensagens)**

```prisma
model Message {
  id              String   @id @default(cuid())
  instanceId      String
  from            String
  to              String
  body            String
  timestamp       DateTime
  isFromMe        Boolean
  isGroup         Boolean  @default(false)
  messageId       String   @unique
  messageType     String   @default("text") // text, interactive, button, image, video, document, audio
  interactiveData String? // JSON com dados de mensagens interativas (botões, etc)
  mediaUrl        String? // URL da mídia salva no Cloudinary
  createdAt       DateTime @default(now())

  instance WhatsAppInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)

  @@index([instanceId, timestamp])
  @@index([instanceId, from, timestamp])
  @@index([instanceId, to, isFromMe, timestamp])
  @@index([timestamp])
}
```

**Características:**
- Armazena todas as mensagens trocadas via WhatsApp
- Suporta múltiplos tipos de mídia (imagem, vídeo, documento, áudio)
- Mensagens interativas (botões) armazenadas em JSON
- Índices otimizados para consultas por instância, contato e data

#### 2. **ConversationStatus (Status das Conversas)**

```prisma
model ConversationStatus {
  id            String   @id @default(cuid())
  instanceId    String
  contactNumber String
  status        String   @default("active") // active, waiting_human, closed
  updatedAt     DateTime @updatedAt
  createdAt     DateTime @default(now())

  instance WhatsAppInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)

  @@unique([instanceId, contactNumber])
  @@index([instanceId, status])
  @@index([status])
}
```

**Características:**
- Controla o status de cada conversa (ativa, aguardando humano, encerrada)
- Chave única por `instanceId` + `contactNumber`
- Permite filtrar conversas por status

#### 3. **Contact (Contatos)**

```prisma
model Contact {
  id                String    @id @default(cuid())
  instanceId        String
  phoneNumber       String
  name              String?
  profilePictureUrl String? // URL da foto de perfil salva no Cloudinary
  lastSeen          DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  instance WhatsAppInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)

  @@unique([instanceId, phoneNumber])
  @@index([instanceId, phoneNumber])
}
```

**Características:**
- Armazena informações dos contatos
- Foto de perfil salva no Cloudinary
- Rastreamento de última visualização

### 🔌 APIs do Chat

#### 1. **GET /api/chat/conversations** - Lista Conversas

**Arquivo:** `app/api/chat/conversations/route.ts`

**Funcionalidade:**
- Lista todas as conversas do usuário agrupadas por contato
- Filtra por status (active, waiting_human, closed)
- Agrupa mensagens por `instanceId` + `contactNumber`
- Retorna última mensagem, contagem de não lidas, nome do contato

**Fluxo:**
1. Busca todas as instâncias do usuário
2. Busca status das conversas
3. Busca todas as mensagens das instâncias
4. Agrupa mensagens por contato
5. Calcula mensagens não lidas
6. Ordena por data da última mensagem

**Query Params:**
- `status` (opcional): Filtra por status específico

#### 2. **DELETE /api/chat/conversations** - Deleta Conversa

**Funcionalidade:**
- Deleta todas as mensagens de uma conversa específica
- Remove o status da conversa

**Query Params:**
- `instanceId`: ID da instância
- `contactNumber`: Número do contato

#### 3. **GET /api/chat/messages** - Busca Mensagens

**Arquivo:** `app/api/chat/messages/route.ts`

**Funcionalidade:**
- Busca mensagens de uma conversa específica
- Suporta paginação (limit, offset)
- Normaliza números de telefone para buscar em diferentes formatos
- Retorna até 200 mensagens por vez

**Query Params:**
- `instanceId`: ID da instância
- `contactNumber`: Número do contato
- `limit` (opcional): Número de mensagens (padrão: 100)
- `offset` (opcional): Offset para paginação

**Normalização:**
- Busca mensagens em múltiplos formatos:
  - Formato original
  - Sem formatação (apenas números)
  - Com código do país (55)

#### 4. **POST /api/chat/messages** - Envia Mensagem Manual

**Funcionalidade:**
- Permite enviar mensagem manualmente pelo dashboard
- Salva mensagem no banco automaticamente
- Usa `sendWhatsAppMessage` do WhatsApp Cloud API

**Body:**
```json
{
  "instanceId": "string",
  "to": "string",
  "message": "string"
}
```

### 🎨 Componente de Interface - ChatManager

**Arquivo:** `components/ChatManager.tsx`

**Funcionalidades:**
- Interface completa de chat (mobile e desktop)
- Três abas: Em Atendimento, Aguardando Resposta, Encerrados
- Lista de conversas com última mensagem e contagem de não lidas
- Área de chat com histórico de mensagens
- Suporte a mensagens interativas (botões)
- Notificação sonora quando conversa vai para "aguardando resposta"
- Atualização automática a cada 5 segundos (conversas) e 3 segundos (mensagens)
- Botão para excluir conversa completa
- Responsivo (mobile e desktop)

**Estados:**
- `activeTab`: Aba atual (active, waiting_human, closed)
- `conversations`: Lista de conversas
- `selectedConversation`: Conversa selecionada
- `messages`: Mensagens da conversa selecionada
- `newMessage`: Texto da nova mensagem
- `showSidebar`: Controla visibilidade da sidebar (mobile)

**Recursos Especiais:**
- Scroll automático para última mensagem
- Formatação de números de telefone brasileiros
- Formatação de timestamps (hoje, ontem, dias da semana)
- Suporte a mensagens interativas com botões

---

## 🛒 ESTRUTURA DO CARRINHO

### 🗄️ Modelos de Dados (Prisma)

#### 1. **Cart (Carrinho)**

```prisma
model Cart {
  id            String   @id @default(cuid())
  userId        String
  instanceId    String
  contactNumber String   // Sempre normalizado (apenas números)
  updatedAt     DateTime @updatedAt
  createdAt     DateTime @default(now())

  user     User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  instance WhatsAppInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)
  items    CartItem[]

  @@unique([instanceId, contactNumber]) // Um carrinho por contato por instância
  @@index([userId])
  @@index([instanceId, contactNumber])
  @@index([updatedAt]) // Para limpar carrinhos antigos
}
```

**Características:**
- Um carrinho único por `instanceId` + `contactNumber`
- Persistido no banco para não perder entre requisições
- Relação com `CartItem[]` (tabela separada)

#### 2. **CartItem (Itens do Carrinho)**

```prisma
model CartItem {
  id            String   @id @default(cuid())
  cartId        String
  productId     String   // ID do produto/serviço
  productType   String   @default("service") // "service" ou "catalog"
  productName   String
  quantity      Int      @default(1)
  unitPrice     Float
  notes         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  cart Cart @relation(fields: [cartId], references: [id], onDelete: Cascade)

  @@unique([cartId, productId, productType]) // Garante que um item único só exista uma vez no carrinho
  @@index([cartId])
}
```

**Características:**
- Tabela relacional para itens do carrinho
- Constraint única: `cartId` + `productId` + `productType`
- Se item já existe, atualiza quantidade (não duplica)

### 📚 Biblioteca de Funções - lib/cart.ts

#### 1. **getCart(instanceId, contactNumber): Promise<Cart>**

**Funcionalidade:**
- Busca ou cria carrinho para um contato
- Normaliza número de contato (remove caracteres não numéricos)
- Busca do banco de dados com itens relacionados
- Tenta encontrar carrinho com variações do número (com/sem código do país)
- Se encontrar com número diferente, atualiza para formato normalizado
- Converte `Decimal` do Prisma para `Number` do JavaScript

**Logs Detalhados:**
- Lista todos os carrinhos da instância para debug
- Mostra itens encontrados
- Avisa se preço está zerado

#### 2. **addToCart(instanceId, contactNumber, item): Promise<Cart>**

**Validações:**
- ✅ ID do produto obrigatório e string válida
- ✅ Nome do produto obrigatório e string válida
- ✅ Quantidade > 0 e inteiro
- ✅ Preço >= 0 e válido (não NaN)
- ✅ Tipo deve ser 'service' ou 'catalog'
- ✅ Limites: quantidade <= 1000, preço <= R$ 1.000.000

**Comportamento:**
- Normaliza número de contato
- Busca ou cria carrinho
- Verifica se item já existe (usando constraint única)
- Se existe: atualiza quantidade (soma)
- Se não existe: cria novo item
- Trata erro de constraint única (P2002) tentando atualizar
- Verifica se item foi realmente salvo após criar
- Atualiza `updatedAt` do carrinho

**Logs Detalhados:**
- Mostra todos os parâmetros recebidos
- Loga cada etapa do processo
- Verifica se item foi salvo corretamente

#### 3. **removeFromCart(instanceId, contactNumber, productId, productType): Promise<Cart>**

**Funcionalidade:**
- Remove item específico do carrinho
- Usa constraint única para encontrar item
- Se carrinho não existe, retorna carrinho vazio
- Se item não encontrado, não é erro crítico (apenas loga)

#### 4. **updateCartItemQuantity(instanceId, contactNumber, productId, productType, quantity): Promise<Cart>**

**Funcionalidade:**
- Atualiza quantidade de um item específico
- Se quantidade <= 0, remove o item
- Valida que carrinho existe

#### 5. **clearCart(instanceId, contactNumber): Promise<void>**

**Funcionalidade:**
- Limpa completamente o carrinho
- Remove todos os itens (cascade)
- Remove o carrinho

#### 6. **getCartTotal(cart): number**

**Funcionalidade:**
- Calcula total do carrinho
- Valida que cálculo não resultou em NaN ou Infinity
- Ignora itens com cálculo inválido (com warning)

#### 7. **validateAndCleanCart(cart): Cart**

**Funcionalidade:**
- Valida e remove itens inválidos automaticamente
- Verifica:
  - Estrutura do item
  - ID e nome válidos
  - Quantidade válida (1-1000, inteiro)
  - Preço válido (0-1.000.000, finito)
  - Tipo válido (service ou catalog)

#### 8. **createOrderFromCart(userId, instanceId, contactNumber, contactName, deliveryType, deliveryAddress?, notes?): Promise<{orderId, paymentLink?, paymentPixKey?}>**

**Funcionalidade:**
- Converte carrinho em pedido
- Valida que carrinho não está vazio
- Valida endereço se for entrega
- Calcula total do carrinho
- Busca informações de pagamento do primeiro produto que tiver:
  - Prioridade: `paymentLink` (gateway) > `paymentPixKey` (Pix) > `cash`
- Cria `Order` e `OrderItem[]` no banco
- Limpa carrinho após sucesso
- Marca produtos como convertidos (ProductInterest)

**Logs Detalhados:**
- Mostra todos os itens sendo convertidos
- Loga método de pagamento escolhido
- Confirma criação do pedido

### 🤖 Integração com IA (workflow-executor.ts)

#### Funções Disponíveis para a IA:

1. **`add_to_cart`**
   - **Parâmetros:** `product_id`, `product_name`, `product_type`, `quantity`, `unit_price`, `notes`
   - **Funcionalidade:**
     - Busca preço do produto no banco (Service ou CatalogNode)
     - Se preço não encontrado, usa o fornecido pela IA
     - Valida todos os parâmetros
     - Adiciona ao carrinho
     - Retorna resumo do carrinho atualizado

2. **`view_cart`**
   - **Funcionalidade:**
     - Busca carrinho atual
     - Retorna lista de itens e total
     - Formata para exibição

3. **`remove_from_cart`**
   - **Parâmetros:** `product_id`, `product_type`
   - **Funcionalidade:**
     - Remove item específico
     - Retorna carrinho atualizado

4. **`clear_cart`**
   - **Funcionalidade:**
     - Limpa todo o carrinho
     - Retorna confirmação

5. **`checkout`**
   - **Parâmetros:** `delivery_type` (pickup/delivery), `delivery_address?`, `notes?`
   - **Funcionalidade:**
     - Valida que carrinho não está vazio
     - Se não informado `delivery_type`, usa "pickup" como padrão
     - Valida endereço se for entrega
     - Cria pedido no banco
     - Retorna informações de pagamento (link ou chave Pix)
     - Limpa carrinho após sucesso

**Fluxo de Processamento:**
1. Cliente envia mensagem
2. IA analisa intenção
3. IA chama função apropriada (ex: `add_to_cart`)
4. Função executa e retorna resultado
5. IA formata resposta e envia ao cliente

**Tratamento de Erros:**
- Try-catch em todas as chamadas
- Mensagens claras retornadas para IA
- Logs detalhados para debug
- Validação prévia antes de executar

---

## 📅 ESTRUTURA DO AGENDAMENTO

### 🗄️ Modelos de Dados (Prisma)

#### 1. **Appointment (Agendamento Confirmado)**

```prisma
model Appointment {
  id            String   @id @default(cuid())
  userId        String
  instanceId    String?
  contactNumber String
  contactName   String?
  date          DateTime // Horário de INÍCIO do agendamento
  endDate       DateTime // Horário de TÉRMINO (calculado: date + duration)
  duration      Int? // Duração em minutos
  description   String?
  status        String   @default("pending") // pending, confirmed, cancelled, completed
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user     User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  instance WhatsAppInstance? @relation(fields: [instanceId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, date])
  @@index([instanceId, date])
  @@index([status])
  @@index([date, endDate]) // Índice para consultas de sobreposição
}
```

**Características:**
- Armazena agendamentos confirmados
- `date`: Horário de início
- `endDate`: Horário de término (calculado automaticamente)
- `duration`: Duração em minutos (vem do serviço)
- Status: pending, confirmed, cancelled, completed
- `instanceId` opcional (pode ser agendamento manual sem instância)

#### 2. **PendingAppointment (Agendamento Pendente de Confirmação)**

```prisma
model PendingAppointment {
  id            String   @id @default(cuid())
  userId        String
  instanceId    String
  contactNumber String
  contactName   String?
  date          String // Data formatada DD/MM/YYYY
  time          String // Hora formatada HH:MM
  duration      Int? // Duração em minutos
  service       String // Nome do serviço
  description   String? // Descrição completa
  expiresAt     DateTime // Quando expira (ex: 1 hora após criação)
  createdAt     DateTime @default(now())

  user     User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  instance WhatsAppInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)

  @@unique([instanceId, contactNumber]) // Apenas um agendamento pendente por contato
  @@index([userId])
  @@index([instanceId, contactNumber])
  @@index([expiresAt]) // Para limpar agendamentos expirados
}
```

**Características:**
- Armazena agendamentos pendentes de confirmação
- Criado quando IA propõe um horário
- Expira após 1 hora (configurável)
- Apenas um pendente por contato (constraint única)
- Data e hora armazenadas como strings formatadas

### 📚 Biblioteca de Funções - lib/appointments.ts

#### 1. **createAppointment(params, workingHours?): Promise<{success, appointment?, error?}>**

**Parâmetros:**
```typescript
{
  userId: string
  instanceId: string | null
  contactNumber: string
  contactName?: string
  date: Date // Horário de INÍCIO
  duration?: number // Duração em minutos (padrão: 60)
  description?: string
}
```

**Validações:**
- ✅ userId obrigatório e válido
- ✅ contactNumber obrigatório e válido
- ✅ date deve ser Date válida
- ✅ Data não pode ser > 1 ano atrás
- ✅ Data não pode ser > 2 anos no futuro
- ✅ duration obrigatória, entre 5 minutos e 24 horas
- ✅ Valida horário de funcionamento ANTES de criar

**Comportamento:**
- Busca horários globais do usuário se não fornecidos
- Valida horário de funcionamento usando `canFitAppointment`
- Calcula `endDate` automaticamente (date + duration)
- Cria com status 'pending' inicialmente
- Compatibilidade com banco antigo (sem endDate/duration):
  - Tenta criar com endDate/duration
  - Se falhar, cria sem esses campos (SQL raw)

**Logs Detalhados:**
- Mostra todos os parâmetros recebidos
- Loga cálculo de endDate
- Avisa se campos não existem no banco

#### 2. **checkAvailability(userId, date, instanceId?): Promise<{success, appointments?, error?}>**

**Funcionalidade:**
- Verifica disponibilidade de horários em uma data específica
- Considera agendamentos CONFIRMADOS e PENDENTES
- Retorna todos os agendamentos do dia

**Fluxo:**
1. Define início e fim do dia
2. Busca agendamentos confirmados (status: pending, confirmed)
3. Busca agendamentos pendentes (não expirados)
4. Combina ambos
5. Calcula endDate se não existir (compatibilidade)

#### 3. **getAvailableTimes(userId, date, durationMinutes, startHour, endHour, instanceId?, workingHours?): Promise<{success, availableTimes?, occupiedTimes?, error?}>**

**Funcionalidade:**
- Lista horários disponíveis em uma data específica
- Considera:
  - Horários de funcionamento do usuário
  - Agendamentos confirmados
  - Agendamentos pendentes (não expirados)
  - Duração do serviço

**Algoritmo:**
1. Busca agendamentos confirmados do dia
2. Busca agendamentos pendentes do dia
3. Cria intervalos ocupados (início e fim)
4. Gera slots de 15 em 15 minutos
5. Para cada slot, verifica:
   - Se está dentro do horário de funcionamento
   - Se não conflita com agendamentos existentes
6. Retorna horários disponíveis

**Retorno:**
- `availableTimes`: Array de horários disponíveis (ex: ["08:00", "08:15", ...])
- `occupiedTimes`: Array de intervalos ocupados (ex: ["08:00-09:00", ...])

#### 4. **getUserAppointments(userId, instanceId, contactNumber, includePast?): Promise<{success, appointments?, error?}>**

**Funcionalidade:**
- Lista agendamentos de um contato específico
- Normaliza número de contato
- Filtra por data (futuros ou todos)
- Calcula endDate se não existir

**Retorno:**
- Array de agendamentos com:
  - `id`, `date`, `description`, `status`
  - `formattedDate`, `formattedTime`, `formattedEndTime`

#### 5. **updateAppointment(appointmentId, userId, newDate): Promise<{success, appointment?, error?}>**

**Funcionalidade:**
- Atualiza horário de um agendamento existente
- Verifica que agendamento pertence ao usuário
- Recalcula endDate baseado na duração existente
- Compatibilidade com banco antigo

#### 6. **cancelAppointment(appointmentId, userId): Promise<{success, appointment?, error?}>**

**Funcionalidade:**
- Cancela um agendamento específico
- Muda status para 'cancelled'
- Verifica que agendamento pertence ao usuário

### 🔌 APIs do Agendamento

#### 1. **GET /api/appointments** - Lista Agendamentos

**Arquivo:** `app/api/appointments/route.ts`

**Funcionalidade:**
- Lista todos os agendamentos do usuário
- Filtra por status (opcional)
- Inclui informações da instância
- Compatibilidade com banco antigo (sem endDate/duration)

**Query Params:**
- `status` (opcional): Filtra por status (pending, confirmed, cancelled, completed)

#### 2. **POST /api/appointments** - Cria Agendamento Manual

**Funcionalidade:**
- Cria agendamento manualmente pelo dashboard
- Valida todos os campos
- Permite definir status inicial

**Body:**
```json
{
  "contactName": "string",
  "contactNumber": "string",
  "description": "string",
  "dateTime": "ISO string",
  "duration": "number",
  "status": "pending|confirmed|completed|cancelled"
}
```

### 🎨 Componente de Interface - SchedulingManager

**Arquivo:** `components/SchedulingManager.tsx`

**Funcionalidades:**
- Calendário mensal interativo
- Visualização de agendamentos por dia
- Lista de próximos agendamentos
- Filtro por data específica
- Criação manual de agendamentos
- Edição de status (confirmar, cancelar, concluir)
- Exclusão de agendamentos
- Integração com serviços (busca duração automaticamente)

**Estados:**
- `appointments`: Lista de agendamentos
- `selectedDate`: Data selecionada no calendário
- `filteredDate`: Data filtrada (se aplicado)
- `currentMonth`: Mês atual do calendário
- `isCreateModalOpen`: Modal de criação aberto

**Recursos Especiais:**
- Conversão automática de UTC para horário do Brasil
- Destaque de dia atual
- Contagem de agendamentos por dia
- Botões rápidos para ações (confirmar, cancelar, concluir)

### 🤖 Integração com IA (workflow-executor.ts)

#### Funções Disponíveis para a IA:

1. **`create_appointment`**
   - **Parâmetros:** `date`, `duration`, `description`
   - **Funcionalidade:**
     - Verifica disponibilidade ANTES de criar
     - Valida horário de funcionamento
     - Cria agendamento
     - Retorna confirmação

2. **`check_availability`**
   - **Parâmetros:** `date`
   - **Funcionalidade:**
     - Verifica se data tem horários disponíveis
     - Retorna boolean

3. **`get_available_times`**
   - **Parâmetros:** `date`, `duration`
   - **Funcionalidade:**
     - Lista todos os horários disponíveis em uma data
     - Retorna array de horários
     - Considera agendamentos pendentes

4. **`get_user_appointments`**
   - **Funcionalidade:**
     - Lista agendamentos do cliente
     - Retorna apenas futuros (padrão)

5. **`update_appointment`**
   - **Parâmetros:** `appointment_id`, `new_date`
   - **Funcionalidade:**
     - Altera horário de agendamento existente
     - Valida disponibilidade do novo horário

6. **`cancel_appointment`**
   - **Parâmetros:** `appointment_id`
   - **Funcionalidade:**
     - Cancela agendamento existente

**Fluxo de Confirmação:**
1. IA propõe horário → Cria `PendingAppointment`
2. Cliente confirma → Processa confirmação
3. Cria `Appointment` confirmado
4. Remove `PendingAppointment`

**Processamento de Confirmação:**
- Função `processAppointmentConfirmation` verifica mensagens
- Detecta "sim", "confirmo", "ok" para confirmar
- Detecta "não", "cancelar" para cancelar
- Processa ANTES de chamar IA (evita loops)

---

## 📦 ESTRUTURA DOS PEDIDOS

### 🗄️ Modelos de Dados (Prisma)

#### 1. **Order (Pedido)**

```prisma
model Order {
  id            String   @id @default(cuid())
  userId        String
  instanceId    String
  contactNumber String
  contactName   String?
  deliveryType  String   @default("pickup") // "pickup" ou "delivery"
  deliveryAddress String? // Endereço completo de entrega
  status        String   @default("pending") // "pending", "confirmed", "preparing", "ready", "delivered", "picked_up", "cancelled"
  totalAmount   Float    @default(0)
  paymentMethod String? // "pix", "gateway", "cash"
  paymentLink   String? // Link de pagamento se houver
  paymentPixKey String? // Chave Pix se houver
  notes         String? // Observações do cliente
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  completedAt   DateTime? // Quando foi concluído

  user       User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  instance   WhatsAppInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)
  items      OrderItem[]

  @@index([userId])
  @@index([instanceId])
  @@index([instanceId, contactNumber])
  @@index([status])
  @@index([createdAt])
}
```

**Características:**
- Armazena pedidos finalizados
- Status completo do ciclo de vida:
  - `pending`: Aguardando confirmação
  - `confirmed`: Confirmado
  - `preparing`: Em preparação
  - `ready`: Pronto para retirada/entrega
  - `delivered`: Entregue
  - `picked_up`: Retirado
  - `cancelled`: Cancelado
- Suporta entrega e retirada
- Múltiplos métodos de pagamento

#### 2. **OrderItem (Itens do Pedido)**

```prisma
model OrderItem {
  id            String   @id @default(cuid())
  orderId       String
  productId     String // ID do produto/serviço
  productType   String   @default("service") // "service" ou "catalog"
  productName   String
  quantity      Int      @default(1)
  unitPrice     Float
  totalPrice    Float
  notes         String? // Observações específicas do item
  createdAt     DateTime @default(now())

  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
  @@index([productId, productType])
}
```

**Características:**
- Armazena itens do pedido
- `totalPrice` = `quantity` * `unitPrice`
- Relação com Order (cascade delete)

### 🔌 APIs dos Pedidos

#### 1. **GET /api/orders** - Lista Pedidos

**Arquivo:** `app/api/orders/route.ts`

**Funcionalidade:**
- Lista todos os pedidos do usuário
- Filtra por status (opcional)
- Inclui informações da instância e itens
- Ordena por data de criação (mais recentes primeiro)

**Query Params:**
- `status` (opcional): Filtra por status

**Retorno:**
```json
{
  "orders": [
    {
      "id": "string",
      "contactNumber": "string",
      "contactName": "string",
      "deliveryType": "pickup|delivery",
      "status": "string",
      "totalAmount": 0,
      "items": [...],
      "instance": {...}
    }
  ]
}
```

#### 2. **PATCH /api/orders/[id]** - Atualiza Status

**Funcionalidade:**
- Atualiza status de um pedido específico
- Valida que pedido pertence ao usuário
- Se status for "delivered" ou "picked_up", define `completedAt`

### 🎨 Componente de Interface - OrdersManager

**Arquivo:** `components/OrdersManager.tsx`

**Funcionalidades:**
- Lista de pedidos com filtros por status
- Estatísticas (total de pedidos, valor total, produtos únicos)
- Visualização detalhada de cada pedido
- Modal para editar status
- Informações completas:
  - Itens do pedido
  - Cliente
  - Endereço de entrega
  - Método de pagamento
  - Observações

**Estados:**
- `orders`: Lista de pedidos
- `filterStatus`: Status filtrado
- `selectedOrder`: Pedido selecionado para detalhes

**Recursos Especiais:**
- Formatação de moeda (BRL)
- Formatação de datas
- Formatação de telefones
- Cores diferentes por status
- Ícones visuais (entrega vs retirada)

### 🔄 Fluxo de Criação de Pedido

1. **Cliente adiciona itens ao carrinho**
   - IA chama `add_to_cart` múltiplas vezes
   - Itens são salvos no `Cart` com `CartItem[]`

2. **Cliente solicita finalizar pedido**
   - IA detecta intenção ("finalizar", "fechar pedido", etc)
   - IA chama `checkout`

3. **Processamento do checkout**
   - Valida que carrinho não está vazio
   - Se não informado, usa "pickup" como padrão
   - Valida endereço se for entrega
   - Busca informações de pagamento dos produtos
   - Cria `Order` e `OrderItem[]` no banco
   - Limpa carrinho
   - Marca produtos como convertidos

4. **Retorno ao cliente**
   - IA recebe informações de pagamento
   - IA formata e envia mensagem com:
     - Resumo do pedido
     - Link de pagamento ou chave Pix
     - Instruções de entrega/retirada

---

## 🔑 IDENTIFICAÇÃO DE CLIENTES

### Sistema de Normalização

**Chave Primária:** `instanceId` + `contactNumber` (normalizado)

**Normalização:**
- Remove todos os caracteres não numéricos: `contactNumber.replace(/\D/g, '')`
- Exemplo:
  - Input: `"+55 (11) 99999-9999"` ou `"5511999999999"`
  - Normalizado: `"5511999999999"`

**Por que não usar apenas `whatsappId`?**
- Sistema já está funcionando com `instanceId` + `contactNumber`
- Permite múltiplas instâncias WhatsApp por usuário
- Facilita rastreamento por instância específica
- Já integrado com todo o sistema existente

**Tratamento de Variações:**
- Sistema tenta encontrar carrinho/agendamento com variações:
  - Com código do país (55)
  - Sem código do país
- Se encontrar com formato diferente, atualiza para formato normalizado

---

## 🔄 FLUXOS DE INTEGRAÇÃO

### Fluxo Completo: Cliente → IA → Sistema → Cliente

#### 1. **Adicionar ao Carrinho**

```
Cliente: "Quero adicionar 2 unidades de Produto X"
    ↓
IA analisa mensagem
    ↓
IA chama função: add_to_cart({
  product_id: "xxx",
  product_name: "Produto X",
  product_type: "catalog",
  quantity: 2,
  unit_price: 50.00
})
    ↓
Sistema:
  1. Busca preço no banco (se não encontrado, usa fornecido)
  2. Normaliza contactNumber
  3. Busca ou cria Cart
  4. Adiciona ou atualiza CartItem
  5. Verifica que foi salvo
    ↓
Retorna: {
  success: true,
  cart: {
    items: [...],
    total: 100.00
  }
}
    ↓
IA formata resposta: "Adicionei 2 unidades de Produto X ao seu carrinho. Total: R$ 100,00"
    ↓
Cliente recebe mensagem
```

#### 2. **Finalizar Pedido (Checkout)**

```
Cliente: "Quero finalizar o pedido"
    ↓
IA detecta intenção de checkout
    ↓
IA chama função: checkout({
  delivery_type: "pickup",
  notes: "Sem observações"
})
    ↓
Sistema:
  1. Busca Cart do contato
  2. Valida que não está vazio
  3. Busca informações de pagamento dos produtos
  4. Cria Order e OrderItem[]
  5. Limpa Cart
  6. Marca produtos como convertidos
    ↓
Retorna: {
  success: true,
  orderId: "xxx",
  paymentLink: "https://...",
  totalAmount: 100.00
}
    ↓
IA formata resposta: "Pedido criado! Total: R$ 100,00. Link de pagamento: https://..."
    ↓
Cliente recebe mensagem
```

#### 3. **Criar Agendamento**

```
Cliente: "Quero agendar para amanhã às 14h"
    ↓
IA analisa mensagem
    ↓
IA chama função: get_available_times({
  date: "2024-11-27",
  duration: 60
})
    ↓
Sistema:
  1. Busca agendamentos confirmados do dia
  2. Busca agendamentos pendentes do dia
  3. Gera slots disponíveis
  4. Filtra por horário de funcionamento
    ↓
Retorna: {
  availableTimes: ["08:00", "08:15", ..., "14:00", ...]
}
    ↓
IA verifica que 14h está disponível
    ↓
IA chama função: create_appointment({
  date: "2024-11-27T14:00:00",
  duration: 60,
  description: "Agendamento"
})
    ↓
Sistema:
  1. Valida data e duração
  2. Valida horário de funcionamento
  3. Calcula endDate
  4. Cria Appointment
    ↓
Retorna: {
  success: true,
  appointment: {...}
}
    ↓
IA formata resposta: "Agendamento criado para 27/11 às 14h!"
    ↓
Cliente recebe mensagem
```

---

## 📊 RESUMO TÉCNICO

### Arquitetura

- **Tipo:** Monolítica (tudo no mesmo processo Next.js)
- **Padrão:** Baseado em funções (não classes)
- **ORM:** Prisma
- **Banco:** PostgreSQL
- **IA:** OpenAI GPT-4

### Persistência

- **Carrinho:** Tabela `Cart` + `CartItem[]` (relacional)
- **Pedidos:** Tabela `Order` + `OrderItem[]` (relacional)
- **Agendamentos:** Tabela `Appointment` (compatibilidade com `PendingAppointment`)
- **Mensagens:** Tabela `Message` (todas as mensagens)

### Validações

- **TypeScript:** Tipos em todas as interfaces
- **Runtime:** Validações manuais em todas as funções
- **Banco:** Constraints únicas e índices
- **Recuperação:** Tratamento automático de erros

### Integração IA

- **Funções expostas:** Via `workflow-executor.ts`
- **Mensagens de erro:** Claras e descritivas para IA
- **Contexto:** Completo do negócio (produtos, serviços, horários)
- **Fluxo:** Mensagem → IA → Função → Sistema → IA → Cliente

### Segurança

- ✅ Validação de todos os inputs
- ✅ Limites de segurança (quantidade, preço)
- ✅ Verificação de propriedade (userId)
- ✅ Normalização de dados
- ✅ Tratamento de erros robusto
- ✅ Logs detalhados para debug

---

**Documento gerado em:** 2024-11-27
**Versão do sistema:** Atual (com todas as melhorias implementadas)




