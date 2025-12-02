# 📋 ESTRUTURA ATUAL DO SISTEMA - CARRINHO E AGENDAMENTO

## 📌 VISÃO GERAL

Este documento descreve a estrutura atual do sistema de **carrinho de compras** e **agendamento de serviços** integrado com um agente de IA via WhatsApp.

**Arquitetura Base:**
- Sistema baseado em `instanceId` + `contactNumber` (não usa `whatsappId` isolado)
- Integração direta com workflow-executor (IA conversacional)
- Persistência no banco de dados PostgreSQL via Prisma ORM
- Validações robustas e tratamento de erros

---

## 🗄️ MODELOS DE DADOS (PRISMA)

### 1. **Cart (Carrinho de Compras)**

```prisma
model Cart {
  id            String   @id @default(cuid())
  userId        String
  instanceId    String
  contactNumber String   // Sempre normalizado (apenas números)
  items         String   // JSON array de CartItem[]
  updatedAt     DateTime @updatedAt
  createdAt     DateTime @default(now())

  user     User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  instance WhatsAppInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)

  @@unique([instanceId, contactNumber]) // Um carrinho por contato por instância
  @@index([userId])
  @@index([instanceId, contactNumber])
  @@index([updatedAt]) // Para limpar carrinhos antigos
}
```

**Características:**
- **Chave única:** `instanceId` + `contactNumber` (normalizado)
- **Armazenamento:** Itens como JSON string (array de `CartItem[]`)
- **Persistência:** Garante que carrinho não seja perdido entre requisições

### 2. **Order (Pedido)**

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
}
```

### 3. **OrderItem (Itens do Pedido)**

```prisma
model OrderItem {
  id            String   @id @default(cuid())
  orderId       String
  productId     String // ID do produto/serviço (Service.id ou CatalogNode.id)
  productType   String   @default("service") // "service" ou "catalog"
  productName   String
  quantity      Int      @default(1)
  unitPrice     Float
  totalPrice    Float
  notes         String? // Observações específicas do item
  createdAt     DateTime @default(now())

  order   Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
}
```

### 4. **Appointment (Agendamento)**

```prisma
model Appointment {
  id            String   @id @default(cuid())
  userId        String
  instanceId    String?
  contactNumber String
  contactName   String?
  date          DateTime // Horário de INÍCIO do agendamento
  endDate       DateTime // Horário de TÉRMINO do agendamento (calculado: date + duration)
  duration      Int? // Duração em minutos (vem do serviço agendado)
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

### 5. **PendingAppointment (Agendamento Pendente de Confirmação)**

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

---

## 🛒 SISTEMA DE CARRINHO (`lib/cart.ts`)

### Interfaces TypeScript

```typescript
export interface CartItem {
  productId: string
  productType: 'service' | 'catalog'
  productName: string
  quantity: number
  unitPrice: number
  notes?: string
}

export interface Cart {
  instanceId: string
  contactNumber: string // Sempre normalizado
  items: CartItem[]
  updatedAt: Date
}
```

### Funções Principais

#### 1. `getCart(instanceId: string, contactNumber: string): Promise<Cart>`
- **Função:** Busca ou cria carrinho para um contato
- **Normalização:** Remove caracteres não numéricos do `contactNumber`
- **Persistência:** Busca do banco de dados
- **Validação:** Valida e limpa itens corrompidos automaticamente
- **Recuperação:** Se JSON estiver corrompido, limpa o carrinho automaticamente

#### 2. `addToCart(instanceId: string, contactNumber: string, item: CartItem): Promise<Cart>`
- **Validações:**
  - ID e nome do produto obrigatórios
  - Quantidade > 0 e inteiro
  - Preço >= 0 e válido
  - Tipo deve ser 'service' ou 'catalog'
  - Limites: quantidade <= 1000, preço <= R$ 1.000.000
- **Comportamento:**
  - Se item já existe, atualiza quantidade
  - Se não existe, adiciona novo item
- **Retry:** Tenta salvar até 3 vezes em caso de falha
- **Verificação:** Confirma que foi salvo corretamente após salvar

#### 3. `removeFromCart(instanceId: string, contactNumber: string, productId: string, productType: 'service' | 'catalog'): Promise<Cart>`
- Remove item específico do carrinho

#### 4. `updateCartItemQuantity(...)`
- Atualiza quantidade de um item específico

#### 5. `clearCart(instanceId: string, contactNumber: string): Promise<void>`
- Limpa completamente o carrinho

#### 6. `getCartTotal(cart: Cart): number`
- Calcula total do carrinho com validação de NaN/Infinity

#### 7. `validateAndCleanCart(cart: Cart): Cart`
- Valida e remove itens inválidos automaticamente

#### 8. `createOrderFromCart(...)`
- Converte carrinho em pedido
- Valida endereço se for entrega
- Busca informações de pagamento dos produtos
- Cria `Order` e `OrderItem[]` no banco
- Limpa carrinho após sucesso
- Marca produtos como convertidos

### Características de Segurança

- ✅ **Validação robusta** de todos os dados antes de salvar
- ✅ **Recuperação automática** de carrinhos corrompidos
- ✅ **Retry automático** em caso de falha de salvamento
- ✅ **Verificação pós-salvamento** para garantir consistência
- ✅ **Limpeza automática** de itens inválidos
- ✅ **Limites de segurança** (quantidade, preço)

---

## 📅 SISTEMA DE AGENDAMENTO (`lib/appointments.ts`)

### Interfaces TypeScript

```typescript
export interface CreateAppointmentParams {
  userId: string
  instanceId: string | null
  contactNumber: string
  contactName?: string
  date: Date // Horário de INÍCIO
  duration?: number // Duração em minutos (padrão: 60)
  description?: string
}
```

### Funções Principais

#### 1. `createAppointment(params: CreateAppointmentParams, workingHours?: WorkingHoursConfig): Promise<{success, appointment?, error?}>`
- **Validações:**
  - userId, contactNumber obrigatórios e válidos
  - date deve ser Date válida
  - Data não pode ser > 1 ano atrás ou > 2 anos no futuro
  - duration obrigatória, entre 5 minutos e 24 horas
- **Comportamento:**
  - Valida horário de funcionamento ANTES de criar
  - Calcula `endDate` automaticamente (date + duration)
  - Cria com status 'pending' inicialmente
  - Compatibilidade com banco antigo (sem endDate/duration)

#### 2. `checkAvailability(userId: string, date: Date, instanceId?: string)`
- Verifica disponibilidade de horários em uma data
- Considera agendamentos CONFIRMADOS e PENDENTES
- Retorna todos os agendamentos do dia

#### 3. `getAvailableTimes(userId: string, date: Date, durationMinutes: number, startHour: number, endHour: number, instanceId?: string, workingHours?: WorkingHoursConfig)`
- Lista horários disponíveis em uma data específica
- Considera:
  - Horários de funcionamento do usuário
  - Agendamentos confirmados
  - Agendamentos pendentes (não expirados)
  - Duração do serviço
- Retorna array de horários disponíveis (ex: ["08:00", "08:15", ...])
- Agrupa horários consecutivos quando há muitos

#### 4. `getUserAppointments(userId: string, instanceId: string, contactNumber: string, includePast: boolean)`
- Lista agendamentos de um contato específico
- Normaliza número de contato
- Filtra por data (futuros ou todos)

#### 5. `updateAppointment(appointmentId: string, userId: string, newDate: Date)`
- Atualiza horário de um agendamento existente
- Recalcula endDate baseado na duração

#### 6. `cancelAppointment(appointmentId: string, userId: string)`
- Cancela um agendamento específico
- Muda status para 'cancelled'

### Características de Segurança

- ✅ **Validação de datas** (não permite muito antigas ou futuras)
- ✅ **Validação de duração** (mínimo 5min, máximo 24h)
- ✅ **Validação de horário de funcionamento** antes de criar
- ✅ **Considera agendamentos pendentes** para evitar conflitos
- ✅ **Compatibilidade com banco antigo** (fallback se campos não existirem)

---

## 🤖 INTEGRAÇÃO COM IA (`lib/workflow-executor.ts`)

### Funções Disponíveis para a IA

#### CARRINHO:

1. **`add_to_cart`**
   - Adiciona produto ao carrinho
   - Parâmetros: `product_id`, `product_name`, `product_type`, `quantity`, `unit_price`, `notes`
   - Retorna resumo do carrinho atualizado

2. **`view_cart`**
   - Visualiza carrinho atual
   - Retorna lista de itens e total

3. **`remove_from_cart`**
   - Remove item específico
   - Parâmetros: `product_id`, `product_type`

4. **`clear_cart`**
   - Limpa todo o carrinho

5. **`checkout`**
   - Finaliza pedido
   - Valida opções de entrega/retirada
   - Cria `Order` no banco
   - Retorna informações de pagamento

#### AGENDAMENTO:

1. **`create_appointment`**
   - Cria novo agendamento
   - Verifica disponibilidade automaticamente ANTES de criar
   - Parâmetros: `date`, `duration`, `description`

2. **`check_availability`**
   - Verifica se data tem horários disponíveis
   - Retorna boolean

3. **`get_available_times`**
   - Lista todos os horários disponíveis em uma data
   - Retorna array de horários

4. **`get_user_appointments`**
   - Lista agendamentos do cliente

5. **`update_appointment`**
   - Altera horário de agendamento existente

6. **`cancel_appointment`**
   - Cancela agendamento existente

### Fluxo de Processamento

1. **Mensagem recebida** → `executeAIOnlyWorkflow()`
2. **Verifica agendamento pendente** → `processAppointmentConfirmation()`
3. **Se processou confirmação** → Retorna sem chamar IA
4. **Se não processou** → Chama IA com contexto completo
5. **IA decide função** → Chama função apropriada
6. **Função executa** → Retorna resultado para IA
7. **IA formata resposta** → Envia mensagem ao cliente

### Tratamento de Erros

- ✅ **Try-catch** em todas as chamadas de função
- ✅ **Mensagens claras** retornadas para a IA
- ✅ **Logs detalhados** para debug
- ✅ **Validação prévia** antes de executar funções

---

## 🔑 IDENTIFICAÇÃO DE CLIENTES

### Sistema Atual

- **Chave primária:** `instanceId` + `contactNumber` (normalizado)
- **Normalização:** Remove todos os caracteres não numéricos
- **Exemplo:** 
  - Input: `"+55 (11) 99999-9999"` ou `"5511999999999"`
  - Normalizado: `"5511999999999"`

### Por que não usar apenas `whatsappId`?

- Sistema já está funcionando com `instanceId` + `contactNumber`
- Permite múltiplas instâncias WhatsApp por usuário
- Facilita rastreamento por instância específica
- Já integrado com todo o sistema existente

---

## 📊 FLUXO DE DADOS

### CARRINHO:

```
Cliente → IA → add_to_cart() → getCart() → Prisma.Cart.findUnique()
                                    ↓
                              Se não existe → Prisma.Cart.create()
                                    ↓
                              addToCart() → Valida → Salva → Verifica
                                    ↓
                              Retorna Cart → IA formata → Cliente
```

### AGENDAMENTO:

```
Cliente → IA → create_appointment() → checkAvailability() → Prisma.Appointment.findMany()
                                                                    ↓
                                                          Valida horário funcionamento
                                                                    ↓
                                                          Prisma.Appointment.create()
                                                                    ↓
                                                          Retorna → IA formata → Cliente
```

---

## ⚠️ PONTOS DE ATENÇÃO / POSSÍVEIS MELHORIAS

### 1. **Armazenamento de Itens do Carrinho**
- **Atual:** JSON string na coluna `items`
- **Prós:** Simples, flexível
- **Contras:** Não tem validação de schema no banco, difícil fazer queries complexas
- **Possível melhoria:** Tabela relacionada `CartItem` (mas requer migration)

### 2. **Normalização de Números**
- **Atual:** Remove `\D` (não numéricos)
- **Funciona bem** mas pode ter edge cases com números internacionais

### 3. **Validação de Produtos**
- **Atual:** Valida apenas estrutura do item
- **Não valida** se produto existe no banco antes de adicionar
- **Possível melhoria:** Validar contra `Service` ou `CatalogNode`

### 4. **Concorrência**
- **Atual:** Upsert com retry
- **Pode ter race conditions** se múltiplas requisições simultâneas
- **Possível melhoria:** Transações ou locks

### 5. **Limpeza de Dados Antigos**
- **Atual:** Índice em `updatedAt` mas sem job automático
- **Possível melhoria:** Job periódico para limpar carrinhos abandonados

### 6. **Agendamentos Pendentes**
- **Atual:** Expiração automática via `expiresAt`
- **Não há job** para limpar expirados
- **Possível melhoria:** Job periódico ou limpeza on-demand

---

## 📝 RESUMO TÉCNICO

**Arquitetura:**
- Monolítica (tudo no mesmo processo)
- Baseada em funções (não classes)
- Integração direta com Prisma ORM

**Persistência:**
- PostgreSQL via Prisma
- JSON para itens do carrinho
- Relações para pedidos e agendamentos

**Validações:**
- TypeScript para tipos
- Validações manuais em runtime
- Recuperação automática de erros

**Integração IA:**
- Funções expostas via workflow-executor
- Mensagens de erro claras para IA
- Contexto completo do negócio

---

**Documento gerado em:** 2024-11-26
**Versão do sistema:** Atual (após melhorias de validação)

