# 📞 Guia: Como Adicionar Números dos Clientes na Sua Conta Meta Business

Este guia mostra como adicionar os números dos seus clientes na sua conta Meta Business central, para que você pague todos os custos e o cliente não precise ter conta Meta Business.

---

## 🎯 Objetivo

Adicionar múltiplos números de WhatsApp na sua conta Meta Business, para que:
- ✅ Você pague todos os custos (seu cartão)
- ✅ Cliente não precise ter conta Meta Business
- ✅ Cliente não precise colocar cartão de crédito
- ✅ Você gerencie tudo centralizadamente

---

## 📋 Pré-requisitos

Antes de começar, você precisa ter:

1. ✅ Uma conta **Meta Business** criada e verificada
2. ✅ Um **App criado** no Meta for Developers com WhatsApp configurado
3. ✅ **Cartão de crédito** adicionado na sua conta Meta Business (para pagar os custos)
4. ✅ Acesso ao **Gerenciador do WhatsApp** (WhatsApp Manager)

---

## 🔑 Passo 1: Acessar o Gerenciador de Números

1. Acesse: https://business.facebook.com/
2. No menu lateral, vá em **"Gerenciador do WhatsApp"** (ou **"WhatsApp Manager"**)
3. Clique em **"Telefones"** (ou **"Phone Numbers"**)
4. Você verá a lista de números já adicionados (se houver)

---

## 📱 Passo 2: Adicionar Número do Cliente

### Opção A: Cliente já tem o número

1. Clique no botão azul **"Adicionar telefone"** (canto superior direito)
2. Selecione **"Adicionar número de telefone"**
3. Digite o número do cliente no formato internacional (ex: +5511999999999)
4. Clique em **"Avançar"**
5. A Meta enviará um código de verificação por SMS para o número
6. **Peça ao cliente** para te passar o código recebido
7. Digite o código de verificação
8. Clique em **"Verificar"**
9. Pronto! O número foi adicionado à sua conta

### Opção B: Solicitar número novo da Meta

1. Clique no botão azul **"Adicionar telefone"**
2. Selecione **"Solicitar número de telefone"**
3. Escolha o país (ex: Brasil)
4. Escolha o tipo de número (móvel, fixo, etc.)
5. Complete o processo de solicitação
6. A Meta fornecerá um número novo que você pode usar

---

## 🔍 Passo 3: Obter Phone Number ID

Após adicionar o número:

1. Na lista de números, encontre o número que você acabou de adicionar
2. Você verá as seguintes informações:
   - **Número de telefone**: +55 11 99999-9999
   - **Nome**: (pode editar)
   - **Status**: Pendente, Conectado, etc.
   - **Classificação de qualidade**: (aparece depois)

3. Para obter o **Phone Number ID**:
   - Clique no número ou no ícone de configurações (engrenagem) ao lado
   - Ou vá em **"Configurações"** → **"Número de telefone"**
   - Você verá o **"ID do número de telefone"** ou **"Phone Number ID"**
   - É um número longo (ex: `123456789012345`)
   - **Copie este ID** - você precisará dele!

---

## ⚙️ Passo 4: Configurar no Sistema

Agora que você tem o Phone Number ID:

1. No seu sistema AutoZap, vá em **"Instâncias WhatsApp"**
2. Crie uma nova instância ou edite uma existente
3. Clique em **"Configurar API"**
4. Preencha:
   - **Phone Number ID**: Cole o ID obtido no Passo 3
   - **Access Token**: Use o token permanente que você já tem (mesmo para todos os números)
   - **App ID**: Use o mesmo App ID (se tiver)
   - **Business Account ID**: Use o mesmo Business Account ID (sua conta)
   - **Número de Telefone**: Digite o número (ex: 5511999999999)
5. Clique em **"Salvar Configuração"**

---

## 🔄 Passo 5: Repetir para Outros Clientes

Para adicionar mais números:

1. Repita o **Passo 2** para cada novo cliente
2. Repita o **Passo 3** para obter o Phone Number ID de cada número
3. Repita o **Passo 4** para configurar cada número no sistema

**Dica:** Você pode adicionar quantos números quiser na mesma conta Meta Business!

---

## 💳 Passo 6: Configurar Pagamento (Importante!)

Como você vai pagar todos os custos:

1. No Meta Business Suite, vá em **"Configurações"** → **"Pagamentos"**
2. Adicione seu **cartão de crédito internacional** ou **PayPal**
3. Configure **créditos pré-pagos** ou **pagamento automático**
4. Acompanhe os custos em **"Faturamento"** → **"Histórico de pagamentos"**

**Importante:**
- 💰 Você paga todos os custos de mensagens
- 📊 Você pode repassar os custos aos clientes como quiser
- 📈 Acompanhe os custos por número/cliente

---

## 📊 Gerenciar Múltiplos Números

### Ver todos os números:
- Vá em **"Gerenciador do WhatsApp"** → **"Telefones"**
- Você verá todos os números adicionados
- Cada número mostra: status, qualidade, última atividade

### Editar informações do número:
- Clique no número ou no ícone de configurações
- Você pode editar: nome, descrição, etc.

### Remover número:
- Clique no ícone de lixeira ao lado do número
- Confirme a remoção

---

## ✅ Checklist para Cada Cliente

Para cada novo cliente, você precisa:

- [ ] Cliente fornece o número de telefone
- [ ] Você adiciona o número na sua conta Meta Business
- [ ] Cliente recebe código SMS e te passa
- [ ] Você verifica o número
- [ ] Você obtém o Phone Number ID
- [ ] Você configura no sistema AutoZap
- [ ] Você configura o webhook (se necessário)
- [ ] Pronto! Cliente pode usar as automações

---

## 🚨 Importante

### Sobre Custos:
- 💳 **Você paga** todos os custos na sua conta Meta Business
- 📊 Custos são por mensagem enviada (conversas iniciadas pela empresa)
- 🆓 Mensagens dentro da janela de 24h são gratuitas (respostas)
- 💰 Você pode repassar custos aos clientes como quiser

### Sobre Limites:
- 📈 Cada número tem seus próprios limites
- 🔢 Limites dependem do plano (gratuito, pago, etc.)
- ⚠️ Acompanhe os limites em **"Limites de mensagens"**

### Sobre Segurança:
- 🔒 Mantenha suas credenciais seguras
- 🔑 Não compartilhe Access Token com clientes
- 📱 Cada número precisa ser verificado por SMS

---

## 📚 Links Úteis

- [Meta Business Suite](https://business.facebook.com/)
- [Gerenciador do WhatsApp](https://business.facebook.com/wa/manage/home/)
- [Documentação Meta Business Manager](https://www.facebook.com/business/help)

---

## 🎉 Pronto!

Agora você pode adicionar quantos números quiser na sua conta e gerenciar tudo centralizadamente. Seus clientes não precisam ter conta Meta Business nem colocar cartão de crédito!

