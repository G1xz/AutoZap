# 📱 Guia Completo: Configurar API da Meta (Produção)

Este guia te ajudará a configurar a API da Meta de forma **definitiva** para produção, substituindo tokens de teste que expiram em 24 horas.

## 🎯 Modelo de Negócio

**Este sistema funciona assim:**
- ✅ Você (dono do sistema) tem UMA conta Meta Business central
- ✅ Você adiciona os números dos clientes na SUA conta Meta Business
- ✅ Você paga todos os custos (cartão seu na Meta)
- ✅ Cliente só fornece o número de telefone (não precisa ter conta Meta Business)
- ✅ Cliente não precisa colocar cartão de crédito
- ✅ Você gerencia tudo centralizadamente

**Vantagens:**
- 🎯 Cliente confia mais (não precisa colocar cartão)
- 💳 Você controla todos os custos
- 📊 Faturamento centralizado
- 🔧 Mais fácil de gerenciar

## 🎯 Objetivo

Migrar de tokens temporários (teste) para tokens permanentes (produção) na WhatsApp Cloud API da Meta.

---

## ❓ Preciso Publicar o App?

**Resposta curta: NÃO, na maioria dos casos você NÃO precisa publicar o app.**

### Quando NÃO precisa publicar:
- ✅ Para uso pessoal ou de pequenos negócios
- ✅ Para enviar mensagens de serviço (respostas automáticas)
- ✅ Para uso com tokens permanentes gerados via Meta Business Suite
- ✅ Para até 1.000 conversas por mês (limite do plano gratuito)

### Quando pode precisar de revisão:
- ⚠️ Para uso comercial em larga escala (muitos clientes)
- ⚠️ Para enviar mensagens de marketing em massa
- ⚠️ Para usar recursos avançados que requerem permissões especiais
- ⚠️ Para escalar além dos limites do plano gratuito

**Para a maioria dos casos de uso, você pode usar tokens permanentes sem precisar publicar o app!**

---

## 📋 Pré-requisitos

Antes de começar, você precisa ter:

1. ✅ Uma conta **Meta Business** (gratuita)
2. ✅ Um **App criado** no Meta for Developers
3. ✅ WhatsApp configurado no seu app
4. ✅ Um número de telefone verificado no WhatsApp Business

---

## 🔑 Passo 1: Obter Token Permanente

### 1.1 Acesse o Meta for Developers

1. Acesse: https://developers.facebook.com/
2. Faça login com sua conta Meta Business
3. Clique em **"Meus Apps"** no canto superior direito
4. Selecione seu app do WhatsApp

### 1.2 Navegue até a Configuração do WhatsApp

1. No menu lateral esquerdo, clique em **"WhatsApp"**
2. Clique em **"Configuração Inicial"** ou **"Getting Started"**

### 1.3 Gere o Token Permanente

**Método 1: Via Meta for Developers (Mais Simples)**

1. Role a página até encontrar a seção **"Token de acesso"** ou **"Access Token"**
2. Você verá duas opções:
   - **Token temporário** (expira em 24 horas) ❌
   - **Token permanente** (não expira) ✅

3. Para gerar um token permanente:
   - Clique em **"Gerar token"** ou **"Renovar token"**
   - Selecione sua **Meta Business Account**
   - Selecione sua **WhatsApp Business Account**
   - Clique em **"Gerar token"**
   - **Copie o token** gerado (você só verá ele uma vez!)

**Método 2: Via Meta Business Suite (Recomendado para Produção)**

1. Acesse: https://business.facebook.com/
2. Vá em **"Usuários"** → **"Usuários do sistema"**
3. Clique em **"Adicionar"** para criar um novo usuário do sistema
4. Dê um nome e atribua a função de **"Administrador"**
5. Clique em **"Criar usuário do sistema"**
6. Selecione o usuário criado e clique em **"Atribuir ativos"**
7. Escolha **"Aplicativos"** e selecione seu app do WhatsApp
8. Conceda **"Controle total"** e salve
9. Ainda na página do usuário, clique em **"Gerar novo token"**
10. Selecione seu app, defina expiração como **"Nunca"**
11. Marque as permissões: `whatsapp_business_management` e `whatsapp_business_messaging`
12. Clique em **"Gerar token"** e copie (só aparece uma vez!)

### 1.4 Importante sobre Tokens

- ⚠️ **Tokens temporários** expiram em 24 horas e são apenas para testes
- ✅ **Tokens permanentes** não expiram, mas podem ser revogados manualmente
- 🔒 Guarde o token em local seguro (ele não será exibido novamente)
- 🔄 Se perder o token, gere um novo seguindo os mesmos passos

---

## 📞 Passo 2: Adicionar Números dos Clientes na Sua Conta

### 2.1 Acessar Gerenciador de Números

1. Acesse: https://business.facebook.com/
2. Vá em **"Gerenciador do WhatsApp"** → **"Telefones"** (ou **"Phone Numbers"**)
3. Você verá a lista de números já adicionados
4. Clique em **"Adicionar telefone"** (botão azul no canto superior direito)

### 2.2 Adicionar Novo Número

1. Clique em **"Adicionar telefone"**
2. Escolha uma das opções:
   - **"Adicionar número de telefone"** - Para adicionar um número novo
   - **"Solicitar número de telefone"** - Para solicitar um número da Meta
3. Se o cliente já tem o número:
   - Selecione **"Adicionar número de telefone"**
   - Digite o número do cliente
   - Siga o processo de verificação (código SMS)
4. Se você vai solicitar um número novo:
   - Selecione **"Solicitar número de telefone"**
   - Escolha o país e tipo de número
   - Complete o processo

### 2.3 Obter Phone Number ID de Cada Número

Após adicionar o número:

1. Na lista de números, encontre o número do cliente
2. Clique no número ou no ícone de configurações (engrenagem)
3. Você verá o **"ID do número de telefone"** ou **"Phone Number ID"**
4. **Copie este ID** - você precisará dele para configurar no sistema

### 2.4 Importante sobre Múltiplos Números

- ✅ Você pode adicionar **múltiplos números** na mesma conta Meta Business
- ✅ Cada número tem seu **próprio Phone Number ID único**
- ✅ Você usa o **mesmo Access Token** para todos os números (ou pode gerar tokens específicos)
- ✅ Todos os custos são cobrados na **sua conta** (seu cartão)

---

## 🏢 Passo 3: Obter App ID e Business Account ID (Opcional mas Recomendado)

### 3.1 App ID

1. No Meta for Developers, vá em **"Configurações"** → **"Básico"**
2. Você verá o **"ID do aplicativo"** ou **"App ID"** no topo da página
3. Copie este ID

### 3.2 Business Account ID

1. Acesse: https://business.facebook.com/
2. Vá em **"Configurações"** → **"Contas"**
3. Procure por **"ID da conta comercial"** ou **"Business Account ID"**
4. Copie este ID

---

## 🔗 Passo 4: Configurar Webhook

### 4.1 Obter a URL do Webhook

1. No seu sistema AutoZap, ao configurar a instância do WhatsApp
2. Você verá a **URL do Webhook** exibida na tela
3. Copie esta URL completa (ex: `https://seu-dominio.com/api/whatsapp/webhook?instanceId=xxx`)

### 4.2 Configurar na Meta

1. No Meta for Developers, vá em **"WhatsApp"** → **"Configuração"**
2. Role até a seção **"Webhooks"**
3. Clique em **"Configurar webhooks"** ou **"Editar"**
4. Cole a URL do webhook no campo **"URL de retorno de chamada"**
5. No campo **"Token de verificação"**, cole o **Webhook Verify Token** gerado pelo sistema
6. Marque os eventos:
   - ✅ **messages** (mensagens recebidas)
   - ✅ **messaging_postbacks** (respostas de botões)
7. Clique em **"Verificar e salvar"**

### 4.3 Verificar Webhook

- A Meta tentará verificar o webhook fazendo uma requisição GET
- Se tudo estiver correto, você verá uma mensagem de sucesso
- Se falhar, verifique:
  - Se a URL está acessível publicamente
  - Se o token de verificação está correto
  - Se o servidor está respondendo corretamente

---

## 💾 Passo 5: Configurar no Sistema

### 5.1 Acessar a Configuração

1. No seu sistema AutoZap, vá em **"Instâncias WhatsApp"**
2. Clique em **"Configurar API"** na instância desejada

### 5.2 Preencher os Dados

**✅ Como funciona:**
- Você já adicionou o número do cliente na sua conta Meta Business (Passo 2)
- Você já tem o Access Token permanente (Passo 1)
- Agora você só precisa do Phone Number ID específico daquele número

Preencha os campos:

- **Phone Number ID**: Cole o ID do número obtido no Passo 2.3 (ID específico daquele número)
- **Access Token**: Cole o token permanente obtido no Passo 1 (mesmo token para todos os números)
- **App ID**: (Opcional) Cole o App ID obtido no Passo 3.1 (mesmo App ID para todos)
- **Business Account ID**: (Opcional) Cole o Business Account ID obtido no Passo 3.2 (sua conta)
- **Número de Telefone**: Digite o número no formato internacional (ex: 5511999999999) - número do cliente
- **Webhook Verify Token**: Deixe em branco para gerar automaticamente, ou defina um personalizado

### 5.3 Salvar Configuração

1. Clique em **"Salvar Configuração"**
2. Aguarde a confirmação de sucesso
3. O status da instância deve mudar para **"Conectado"**

### 5.4 Processo Simplificado para Clientes

**O que o cliente precisa fazer:**

1. ✅ Cliente te fornece apenas o **número de telefone**
2. ✅ Você adiciona o número na sua conta Meta Business
3. ✅ Você obtém o Phone Number ID
4. ✅ Você configura no sistema
5. ✅ Pronto! Cliente não precisa ter conta Meta Business nem colocar cartão

---

## ✅ Passo 6: Verificar Funcionamento

### 6.1 Testar Envio de Mensagem

1. No sistema, vá em **"Chat"** ou **"Conversas"**
2. Tente enviar uma mensagem de teste
3. Verifique se a mensagem foi enviada com sucesso

### 6.2 Testar Recebimento de Mensagem

1. Envie uma mensagem do WhatsApp para o número configurado
2. Verifique se a mensagem aparece no sistema
3. Verifique se os workflows de automação estão funcionando

---

## 🔄 Diferenças: Teste vs Produção

| Aspecto | Token de Teste | Token de Produção |
|--------|----------------|-------------------|
| **Validade** | 24 horas | Permanente |
| **Uso** | Apenas testes | Produção |
| **Limites** | Limitados | Completos |
| **Renovação** | Automática (24h) | Manual (se necessário) |
| **Recomendado para** | Desenvolvimento | Clientes reais |
| **Precisa publicar app?** | Não | Não (na maioria dos casos) |

## 📱 Publicação do App: Quando é Necessário?

### ✅ Cada Cliente NÃO precisa publicar se:
- Está usando para seu próprio negócio
- Envia até 1.000 conversas/mês (plano gratuito)
- Usa apenas mensagens de serviço (respostas automáticas)
- Tem um volume moderado de mensagens

### ⚠️ Cliente pode precisar revisão se:
- Quer escalar para muitos clientes finais
- Precisa enviar mensagens de marketing em massa
- Quer usar recursos avançados (templates complexos, etc.)
- Precisa de limites maiores que o plano gratuito

**Dica:** Cada cliente começa sem publicar. Se precisar escalar, a Meta avisará quando for necessário passar por revisão.

## 🏢 Modelo de Negócio: Como Funciona

### Para Você (Dono do Sistema):
1. ✅ Você tem UMA conta Meta Business central
2. ✅ Você adiciona números dos clientes na sua conta (via Meta Business Manager)
3. ✅ Você paga todos os custos (seu cartão na Meta)
4. ✅ Você obtém Phone Number ID de cada número adicionado
5. ✅ Você configura cada instância no sistema
6. ✅ Você gerencia as automações e workflows
7. ✅ Você controla tudo centralizadamente

### Para Seus Clientes Finais:
1. ✅ Cliente te fornece apenas o **número de telefone**
2. ✅ Cliente autoriza você a usar o número (verificação por SMS)
3. ✅ Cliente usa as automações que você configurou
4. ❌ Cliente **NÃO precisa** ter conta Meta Business
5. ❌ Cliente **NÃO precisa** colocar cartão de crédito
6. ❌ Cliente **NÃO precisa** configurar nada técnico

**Vantagens:**
- 🎯 Cliente confia mais (não precisa colocar cartão)
- 💳 Você controla todos os custos e faturamento
- 🔧 Mais fácil de gerenciar (tudo centralizado)
- 📊 Você pode repassar custos aos clientes como quiser
- ⚡ Setup mais rápido (cliente só fornece número)

---

## 🚨 Problemas Comuns e Soluções

### Problema: Token expira em 24 horas

**Solução**: Você está usando um token temporário. Siga o Passo 1 para gerar um token permanente.

### Problema: Webhook não verifica

**Soluções**:
- Verifique se a URL está acessível publicamente
- Confirme que o token de verificação está correto
- Verifique se o servidor está respondendo na rota `/api/whatsapp/webhook`

### Problema: Mensagens não são recebidas

**Soluções**:
- Verifique se o webhook está configurado corretamente na Meta
- Confirme que os eventos `messages` estão marcados
- Verifique os logs do servidor para erros

### Problema: Mensagens não são enviadas

**Soluções**:
- Verifique se o token ainda é válido
- Confirme que o Phone Number ID está correto
- Verifique se o número está verificado na Meta Business

---

## 📚 Links Úteis

- [Documentação Oficial da Meta](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [Guia de Tokens](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started#get-access-token)
- [Configuração de Webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
- [Meta Business Suite](https://business.facebook.com/)

---

## 🎉 Pronto!

Agora sua API está configurada de forma definitiva para produção! 

**Lembre-se:**
- ✅ Use tokens permanentes para produção
- ✅ Mantenha suas credenciais seguras
- ✅ Configure o webhook corretamente
- ✅ Teste antes de usar com clientes reais

Se tiver dúvidas, consulte a documentação oficial da Meta ou entre em contato com o suporte.

