# 🚀 Guia de Migração - WhatsApp Cloud API

## ✅ O que foi feito

O projeto foi migrado de `whatsapp-web.js` para **WhatsApp Cloud API (Meta)**.

### Mudanças Principais:

1. ✅ Removido `whatsapp-web.js` e `qrcode-terminal`
2. ✅ Adicionado suporte para WhatsApp Cloud API
3. ✅ Criado sistema de webhooks para receber mensagens
4. ✅ Atualizado schema do banco para armazenar tokens
5. ✅ Nova interface para configurar a API

---

## 📋 Próximos Passos

### 1. Atualizar o Banco de Dados

Execute as migrações do Prisma:

```bash
npm run db:generate
npm run db:push
```

### 2. Remover Dependências Antigas

```bash
npm uninstall whatsapp-web.js
npm install
```

### 3. Configurar WhatsApp Cloud API

#### Passo 1: Criar Conta Meta Business
1. Acesse: https://business.facebook.com
2. Crie uma conta Business
3. Complete o perfil da empresa

#### Passo 2: Criar App no Meta for Developers
1. Acesse: https://developers.facebook.com
2. Clique em "Meus Apps" → "Criar App"
3. Escolha tipo: **Business**
4. Preencha informações básicas

#### Passo 3: Configurar WhatsApp
1. No dashboard do app, procure por "WhatsApp"
2. Clique em "Configurar" no produto WhatsApp
3. Siga o assistente de configuração

#### Passo 4: Obter Credenciais
1. **Phone Number ID**: Encontre em "WhatsApp" → "Configuração Inicial"
2. **Access Token**: Em "WhatsApp" → "Token"
   - Use token temporário (24h) para testes
   - Para produção, gere token permanente

#### Passo 5: Configurar no Sistema
1. Acesse o dashboard
2. Crie uma nova instância
3. Clique em "Configurar API"
4. Preencha:
   - Phone Number ID
   - Access Token
   - Número de telefone (opcional)
   - Outros campos (opcionais)

#### Passo 6: Configurar Webhook
1. No Meta for Developers, vá em "WhatsApp" → "Configuração" → "Webhooks"
2. Clique em "Configurar Webhooks"
3. URL do Callback: `https://seu-dominio.com/api/whatsapp/webhook?instanceId=SEU_INSTANCE_ID`
4. Token de Verificação: Use o token gerado na configuração da instância
5. Eventos: Marque "messages"

---

## 🔄 Diferenças Principais

### Antes (whatsapp-web.js):
- ❌ QR Code para conectar
- ❌ Risco de banimento
- ❌ Depende de Puppeteer
- ❌ Sessão local

### Agora (WhatsApp Cloud API):
- ✅ API oficial e segura
- ✅ Sem risco de banimento
- ✅ Webhooks para receber mensagens
- ✅ Escalável
- ✅ Primeiros 1.000 conversas/mês GRÁTIS

---

## 📝 Variáveis de Ambiente

Adicione ao `.env` se necessário:

```env
# WhatsApp Cloud API (opcional - tokens são salvos no banco)
WHATSAPP_API_VERSION=v18.0
```

---

## 🧪 Testando

1. **Criar Instância**: Dashboard → Criar Instância
2. **Configurar API**: Clique em "Configurar API" e preencha os dados
3. **Configurar Webhook**: No Meta for Developers
4. **Testar**: Envie uma mensagem para o número configurado
5. **Verificar**: A mensagem deve aparecer no sistema e a automação deve responder

---

## ⚠️ Importante

- **Tokens Temporários**: Válidos por 24 horas apenas
- **Tokens Permanentes**: Necessários para produção
- **Webhook**: Precisa estar acessível publicamente (use ngrok para desenvolvimento)
- **Número**: Não pode ser o mesmo do WhatsApp pessoal

---

## 📚 Documentação

- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Guia de Início Rápido](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [Webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)

---

## 🆘 Problemas Comuns

### Erro: "Token inválido"
- Verifique se o token não expirou (tokens temporários duram 24h)
- Gere um novo token no Meta for Developers

### Webhook não funciona
- Verifique se a URL está acessível publicamente
- Use ngrok para desenvolvimento local
- Verifique se o token de verificação está correto

### Mensagens não chegam
- Verifique se o webhook está configurado corretamente
- Verifique os logs do servidor
- Confirme que o número está verificado no Meta

---

**Pronto! O sistema está migrado para usar a WhatsApp Cloud API oficial!** 🎉



