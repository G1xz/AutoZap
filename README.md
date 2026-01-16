# AutoZap - Sistema de Automação WhatsApp

Sistema completo de automação e gestão de mensagens via WhatsApp Business API.

## 🚀 Funcionalidades Principais

- **Gestão de Instâncias WhatsApp**: Conecte múltiplas contas WhatsApp Business
- **Workflows Automatizados**: Crie fluxos de conversa com IA ou questionários
- **Chat em Tempo Real**: Interface para conversar com clientes
- **Agendamentos**: Sistema completo de agendamento de serviços
- **Carrinho de Compras**: Integração de e-commerce via WhatsApp
- **IA Integrada**: Respostas automáticas inteligentes com OpenAI

## 📋 Pré-requisitos

- Node.js 18+ 
- PostgreSQL
- Conta Meta/Facebook Developer
- App WhatsApp Business configurado
- OpenAI API Key (para funcionalidades de IA)

## 🔧 Instalação

1. Clone o repositório
2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente (`.env`):
```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
FACEBOOK_CLIENT_ID="..."
FACEBOOK_CLIENT_SECRET="..."
OPENAI_API_KEY="..."
CLOUDINARY_URL="..."
WEBHOOK_VERIFY_TOKEN="..."
```

4. Execute as migrações:
```bash
npx prisma migrate dev
```

5. Inicie o servidor:
```bash
npm run dev
```

## 🔗 Configuração WhatsApp Business

### 1. Criar App no Meta for Developers

1. Acesse https://developers.facebook.com
2. Crie um novo app do tipo "Business"
3. Adicione o produto "WhatsApp"
4. Configure as permissões necessárias

### 2. Configurar Webhook

1. No app, vá em WhatsApp → Configuração
2. Configure a URL do webhook: `https://seu-dominio.com/api/whatsapp/webhook`
3. Configure o token de verificação (use `WEBHOOK_VERIFY_TOKEN`)
4. Marque os eventos: `messages` (obrigatório)

### 3. Conectar Instância

1. No dashboard, vá em "Instâncias WhatsApp"
2. Clique em "Conectar"
3. Autorize o app no Facebook
4. A instância será configurada automaticamente

## 🧪 Testes

### Teste Rápido - Mensagens

1. **Verificar Status da Instância**
   - Dashboard → Instâncias WhatsApp
   - Status deve estar "Conectado" e ativa

2. **Enviar Mensagem pelo Site**
   - Vá em Chat/Conversas
   - Envie uma mensagem de teste
   - Verifique se foi entregue no WhatsApp

3. **Receber e Responder pelo WhatsApp**
   - Envie uma mensagem do WhatsApp para o número conectado
   - Use palavras como "oi", "olá" ou o trigger do workflow
   - Aguarde resposta automática

### Verificar Logs

**Logs de Sucesso:**
```
✅ Nova mensagem recebida { instanceId: '...', from: '...' }
✅ Mensagem enviada com sucesso { instanceId: '...', to: '...' }
```

**Logs de Problema:**
```
❌ Instância não está conectada
❌ Erro ao enviar mensagem WhatsApp
```

## 🐛 Troubleshooting

### Mensagens não são enviadas

- Verifique se a instância está conectada (`status: 'connected'`)
- Verifique se a instância está ativa (`active: true`)
- Verifique se o `phoneId` está configurado
- Verifique se o `accessToken` está válido
- Verifique se o limite mensal não foi excedido

### Mensagens recebidas mas sem resposta automática

- Verifique se há workflows ativos configurados
- Verifique se o trigger corresponde à mensagem recebida
- Verifique se a conversa não está encerrada (`status: 'closed'`)
- Verifique os logs para erros no `executeWorkflows`

### Webhook não recebe mensagens

- Verifique se os eventos estão marcados no Meta (`messages`)
- Verifique se o webhook está verificado
- Verifique se a URL do webhook está correta
- Verifique os logs do servidor

## 📁 Estrutura do Projeto

```
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── whatsapp/     # Endpoints WhatsApp
│   │   ├── chat/         # Endpoints de chat
│   │   └── ...
│   └── dashboard/        # Páginas do dashboard
├── components/            # Componentes React
├── lib/                  # Bibliotecas e utilitários
│   ├── whatsapp-cloud-api.ts  # API WhatsApp
│   ├── workflow-executor.ts   # Executor de workflows
│   └── ...
├── prisma/               # Schema e migrações
└── public/               # Arquivos estáticos
```

## 🔐 Segurança

- Tokens e senhas nunca devem ser commitados
- Use variáveis de ambiente para dados sensíveis
- Valide todas as requisições do webhook
- Implemente rate limiting onde necessário

## 📝 Notas Importantes

- **Modo de Teste**: O sistema tem proteção para que o modo de teste não interfira com mensagens reais do WhatsApp
- **Limites Mensais**: Cada instância tem um limite configurável de mensagens por mês
- **Status de Conversa**: Conversas podem ser encerradas automaticamente ou manualmente

## 🆘 Suporte

Para problemas ou dúvidas:
1. Verifique os logs do servidor
2. Verifique a configuração da instância
3. Verifique os logs do Meta for Developers

---

**Última atualização**: Sistema corrigido para garantir que mensagens do WhatsApp sempre sejam enviadas, mesmo com modo de teste ativo.
