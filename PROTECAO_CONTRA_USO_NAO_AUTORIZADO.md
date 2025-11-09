# 🔒 Proteção Contra Uso Não Autorizado

Problema identificado: Se cliente cancelar, mas conta continuar conectada, ele pode usar e você paga!

---

## ⚠️ O Problema

### Cenário Perigoso:

1. ✅ Cliente conecta via OAuth
2. ✅ Você adiciona no seu Business Manager
3. ✅ Você configura billing (seu cartão)
4. ❌ **Cliente cancela o serviço**
5. ❌ **Mas conta ainda está conectada**
6. ❌ **Cliente continua usando → você paga!** 💸

---

## ✅ Soluções

### Solução 1: Remover Acesso Quando Cancelar (Manual)

**Quando cliente cancelar:**

1. Você acessa: https://business.facebook.com/
2. Vá em "Configurações" → "Contas" → "Contas de negócios"
3. Encontre a conta do cliente
4. Clique em **"Remover"** ou **"Revogar acesso"**
5. Pronto! Cliente não consegue mais usar

**Limitação:**
- ⚠️ Precisa fazer manualmente
- ⚠️ Pode esquecer de remover

---

### Solução 2: Desativar Instância no Sistema (Automático)

**Implementar no código:**

1. Quando cliente cancelar, **desativar instância** no sistema
2. Sistema **não permite** enviar mensagens de instâncias desativadas
3. Cliente não consegue usar mesmo com conta conectada

**Como fazer:**
- Adicionar campo `active: boolean` na instância
- Verificar antes de enviar mensagens
- Desativar quando cancelar

---

### Solução 3: Revogar Token (Automático)

**Implementar no código:**

1. Quando cliente cancelar, **revogar o Access Token**
2. Token fica inválido
3. Cliente não consegue usar mesmo com conta conectada

**Como fazer:**
- Chamar API do Facebook para revogar token
- Ou invalidar token no sistema

---

### Solução 4: Monitorar Uso e Limitar (Recomendado)

**Implementar no código:**

1. **Monitorar** uso de cada instância
2. **Limitar** número de mensagens por mês
3. **Bloquear** se exceder limite
4. **Alertar** você se uso suspeito

**Como fazer:**
- Contar mensagens enviadas por instância
- Definir limite mensal
- Bloquear automaticamente se exceder

---

## 🎯 Solução Completa (Recomendada)

### Combinar Múltiplas Proteções:

1. ✅ **Desativar instância** no sistema quando cancelar
2. ✅ **Remover acesso** no Business Manager
3. ✅ **Monitorar uso** e alertar se suspeito
4. ✅ **Limitar mensagens** por mês
5. ✅ **Revogar token** se necessário

---

## 🔧 Implementação no Código

### 1. Adicionar Campo `active` na Instância

```typescript
// prisma/schema.prisma
model WhatsAppInstance {
  // ... campos existentes
  active Boolean @default(true) // Nova campo
}
```

### 2. Verificar Antes de Enviar

```typescript
// lib/whatsapp-cloud-api.ts
export async function sendWhatsAppMessage(...) {
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { id: instanceId },
  })

  // Verificar se está ativa
  if (!instance?.active) {
    throw new Error('Instância desativada. Contate o suporte.')
  }

  // ... resto do código
}
```

### 3. Função para Desativar

```typescript
// app/api/whatsapp/deactivate/route.ts
export async function POST(request: NextRequest) {
  const { instanceId } = await request.json()
  
  await prisma.whatsAppInstance.update({
    where: { id: instanceId },
    data: { active: false }
  })
  
  // Opcional: Revogar token no Facebook
  // ...
}
```

---

## 📊 Monitoramento de Uso

### Adicionar Contador de Mensagens

```typescript
// prisma/schema.prisma
model WhatsAppInstance {
  // ... campos existentes
  messagesSentThisMonth Int @default(0)
  monthlyLimit Int @default(1000) // Limite mensal
  lastResetDate DateTime @default(now())
}
```

### Verificar Limite Antes de Enviar

```typescript
// Verificar se excedeu limite
if (instance.messagesSentThisMonth >= instance.monthlyLimit) {
  throw new Error('Limite mensal excedido. Entre em contato para aumentar.')
}

// Incrementar contador após enviar
await prisma.whatsAppInstance.update({
  where: { id: instanceId },
  data: { 
    messagesSentThisMonth: { increment: 1 }
  }
})
```

---

## 🚨 Alertas e Notificações

### Alertar se Uso Suspeito

```typescript
// Se uso exceder 80% do limite, alertar
if (instance.messagesSentThisMonth >= instance.monthlyLimit * 0.8) {
  // Enviar email/notificação para você
  await sendAlert({
    type: 'HIGH_USAGE',
    instanceId,
    usage: instance.messagesSentThisMonth,
    limit: instance.monthlyLimit
  })
}
```

---

## ✅ Checklist de Proteção

Quando cliente cancelar:

- [ ] Desativar instância no sistema
- [ ] Remover acesso no Business Manager
- [ ] Revogar token (opcional)
- [ ] Notificar cliente que acesso foi revogado
- [ ] Monitorar uso por alguns dias

---

## 💡 Resumo

**Problema:** Cliente cancelar mas continuar usando → você paga

**Soluções:**
1. ✅ **Desativar instância** (bloqueia no sistema)
2. ✅ **Remover acesso** (bloqueia no Business Manager)
3. ✅ **Monitorar uso** (detecta uso suspeito)
4. ✅ **Limitar mensagens** (previne abuso)

**Recomendação:** Use todas as proteções juntas!

---

Quer que eu implemente essas proteções no código? 🛡️

