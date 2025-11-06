# 💰 Preços e Limites - WhatsApp Cloud API

## ✅ O que é GRATUITO

### Tier Gratuito: 1.000 Conversas por Mês

**Importante entender o que é uma "CONVERSA":**
- Uma **conversa** é uma **janela de 24 horas** com um contato
- Durante essas 24 horas, você pode enviar **mensagens ilimitadas** gratuitamente
- Depois de 24 horas sem interação, a conversa "fecha"
- Uma nova mensagem abre uma nova conversa (nova janela de 24h)

**Exemplo prático:**
- Cliente A manda mensagem hoje → 1 conversa (gratuita)
- Você responde 10 vezes hoje → Ainda é 1 conversa (gratuita)
- Cliente A manda mensagem amanhã → Nova conversa (gratuita, se ainda estiver dentro das 1.000)
- Cliente B manda mensagem → 2 conversas no total

---

## 💸 O que é PAGO (após 1.000 conversas/mês)

### Custos por Tipo de Mensagem (Brasil)

| Tipo de Mensagem | Custo por Conversa | Quando é Cobrado |
|------------------|---------------------|------------------|
| **Mensagens de Serviço** | **GRÁTIS** | Quando o cliente inicia |
| **Mensagens de Utilidade** | ~R$ 0,04 | Empresa inicia |
| **Mensagens de Marketing** | ~R$ 0,34 | Empresa inicia |
| **Mensagens de Autenticação** | ~R$ 0,17 | Empresa inicia |

### Explicação dos Tipos:

1. **Serviço (Service)** - GRÁTIS na janela de 24h após cliente iniciar
   - ✅ Respostas a perguntas do cliente
   - ✅ Atendimento ao cliente
   - ✅ Suporte técnico
   - ✅ **Ideal para automações de resposta**
   - ⚠️ **Importante:** Apenas GRÁTIS por 24 horas após o cliente iniciar

2. **Utilidade (Utility)** - ~R$ 0,04
   - Confirmações de pedidos
   - Atualizações de status
   - Notificações transacionais

3. **Marketing** - ~R$ 0,34 (SEMPRE PAGO, mesmo se cliente iniciou)
   - Promoções
   - Newsletter
   - Campanhas publicitárias

4. **Autenticação** - ~R$ 0,17
   - Códigos de verificação
   - Senhas temporárias

### ⚠️ REGRA IMPORTANTE: Janela de 24 Horas

**Quando o cliente inicia uma conversa:**
- ✅ Você tem **24 horas GRÁTIS** para enviar mensagens de **SERVIÇO**
- ✅ Durante essas 24h, pode enviar quantas mensagens de serviço quiser (GRÁTIS)
- ❌ Depois de 24h, a conversa "fecha" e você precisa pagar para iniciar uma nova
- ❌ Mensagens de **MARKETING** são sempre pagas, mesmo na janela de 24h

---

## 📊 Cenários Práticos

### Cenário 1: Pequeno Negócio (GRATUITO)
- **10-20 clientes ativos por mês**
- Cada cliente manda 1-2 mensagens
- **Total: ~20-40 conversas/mês**
- ✅ **100% GRATUITO**

### Cenário 2: Médio Negócio (Parcialmente Pago)
- **100 clientes ativos por mês**
- Cada cliente interage 5-10 vezes
- Mas como são na mesma janela de 24h, são ~100 conversas
- ✅ **Ainda GRATUITO** (dentro das 1.000)

### Cenário 3: Negócio Grande (Pago)
- **500 clientes ativos por mês**
- Cada cliente interage várias vezes
- Total: ~1.500 conversas/mês
- 💰 **500 conversas pagas** × R$ 0,04 = **~R$ 20/mês**

### Cenário 4: Muitos Clientes (Pago)
- **2.000 clientes ativos por mês**
- Total: ~2.000 conversas/mês
- 💰 **1.000 conversas pagas** × R$ 0,04 = **~R$ 40/mês**

---

## 🎯 Para Múltiplos Clientes

### Se você vai usar para vários clientes:

**Cenário Realista:**
- Você tem 10 clientes (empresas)
- Cada empresa tem 50 clientes ativos/mês
- Total: 10 × 50 = 500 conversas/mês por empresa
- **Total geral: 5.000 conversas/mês**

**Custo:**
- 1.000 conversas: GRÁTIS
- 4.000 conversas: 4.000 × R$ 0,04 = **R$ 160/mês**

---

## 💡 Estratégias para Reduzir Custos

1. **Use Mensagens de Serviço** (GRÁTIS)
   - Configure automações como "respostas a perguntas"
   - Sempre que o cliente inicia, é GRÁTIS

2. **Agrupe Respostas**
   - Responda tudo na mesma janela de 24h
   - Evite abrir novas conversas desnecessariamente

3. **Monitore o Uso**
   - Acompanhe quantas conversas você está usando
   - Otimize quando se aproximar de 1.000

4. **Use o Tier Gratuito Inteligentemente**
   - Para começar, 1.000 conversas são suficientes
   - Quando crescer, o custo é baixo (R$ 0,04 por conversa)

---

## 📈 Resumo

| Volume de Conversas/Mês | Custo Mensal |
|-------------------------|--------------|
| Até 1.000 | **GRÁTIS** ✅ |
| 1.500 | ~R$ 20 |
| 2.000 | ~R$ 40 |
| 5.000 | ~R$ 160 |
| 10.000 | ~R$ 360 |

---

## ✅ Conclusão

**Para começar:** É **GRATUITO** até 1.000 conversas/mês

**Para múltiplos clientes:** 
- Se cada cliente tem poucos usuários finais → pode ser gratuito
- Se tiver muitos usuários → custo baixo (R$ 0,04 por conversa extra)

**Recomendação:** 
- Comece usando a API gratuita
- Monitore o uso
- Quando passar de 1.000, o custo é acessível
- Para automações de resposta (serviço), muitas vezes é GRÁTIS mesmo

---

**Quer que eu adapte o código para usar a WhatsApp Cloud API?**

