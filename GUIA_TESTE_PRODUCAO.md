# 🧪 Guia de Teste Completo - Produção

Agora que o app está publicado, vamos testar se tudo está funcionando corretamente!

---

## ✅ Checklist Antes de Testar

### 1. Variáveis de Ambiente (Vercel)
- [ ] `FACEBOOK_CLIENT_ID` configurado
- [ ] `FACEBOOK_CLIENT_SECRET` configurado
- [ ] `NEXTAUTH_URL` configurado com o domínio correto (`https://autoflow.dev.br`)
- [ ] `NEXTAUTH_SECRET` configurado
- [ ] `DATABASE_URL` configurado

### 2. Meta for Developers
- [ ] URL de callback configurada: `https://autoflow.dev.br/api/whatsapp/facebook-callback`
- [ ] "Forçar HTTPS" ativado
- [ ] App publicado
- [ ] Permissões aprovadas:
  - `whatsapp_business_messaging` ✅
  - `whatsapp_business_management` ✅
  - `business_management` ✅

### 3. Conta de Teste
- [ ] Ter uma conta Meta Business com WhatsApp Business configurado
- [ ] Ter pelo menos um número de telefone verificado no WhatsApp Business
- [ ] Número não pode ser de teste (agora precisa ser número real)

---

## 🧪 Passo 1: Acessar o Sistema

1. Acesse: `https://autoflow.dev.br/dashboard`
2. Faça login (ou crie uma conta se necessário)

**✅ Verificar:** Você consegue acessar o dashboard sem erros?

---

## 🧪 Passo 2: Criar Instância WhatsApp

1. No dashboard, vá em **"Instâncias WhatsApp"** (ou similar)
2. Clique em **"Criar Nova Instância"** ou **"Adicionar Instância"**
3. Dê um nome (ex: "Teste Produção")
4. Salve

**✅ Verificar:** A instância foi criada e aparece na lista?

---

## 🧪 Passo 3: Conectar via Facebook OAuth

1. Encontre a instância que você criou
2. Procure pelo botão **"🔵 Conectar via Facebook"** ou **"Conectar via Facebook"**
3. Clique no botão

**✅ Verificar:** Uma nova janela/aba abre com a tela de autorização do Facebook?

---

## 🧪 Passo 4: Autorizar no Facebook

1. Na janela que abriu, faça login no Facebook (se necessário)
2. Revise as permissões solicitadas:
   - Gerenciar negócios
   - WhatsApp Business Management
   - WhatsApp Business Messaging
3. Clique em **"Continuar"** ou **"Autorizar"**

**✅ Verificar:** 
- A autorização é aceita sem erros?
- Você é redirecionado de volta para o sistema?
- A janela popup fecha automaticamente?

---

## 🧪 Passo 5: Verificar Conexão

Após autorizar, verifique:

1. **Status da Instância:**
   - Deve mostrar status **"Conectado"** ou **"Connected"**
   - Não deve mostrar mais "Desconectado"

2. **Informações Obtidas:**
   - Phone Number ID (deve aparecer)
   - Business Account ID (pode aparecer)
   - Número de telefone (deve aparecer)
   - Status: "Conectado"

3. **No Banco de Dados:**
   - `phoneId` preenchido
   - `accessToken` preenchido
   - `status` = "connected"

**✅ Verificar:** Todas as informações foram obtidas corretamente?

---

## 🧪 Passo 6: Testar Envio de Mensagem

Agora vamos testar se o envio de mensagem funciona:

1. Vá para a área de **"Chat"** ou **"Mensagens"**
2. Selecione a instância conectada
3. Tente enviar uma mensagem de teste para um número real
4. Verifique se a mensagem foi entregue

**✅ Verificar:**
- A mensagem é enviada sem erros?
- A mensagem chega no WhatsApp do destinatário?
- O status da mensagem é "entregue" ou "enviada"?

---

## 🧪 Passo 7: Testar Recebimento de Mensagem

1. Envie uma mensagem do WhatsApp para o número conectado
2. Verifique se a mensagem aparece no sistema
3. Verifique se o sistema responde automaticamente (se configurado)

**✅ Verificar:**
- A mensagem é recebida no sistema?
- O webhook está funcionando?
- A resposta automática funciona (se configurada)?

---

## 🔍 O Que Verificar nos Logs

Se algo não funcionar, verifique os logs:

### No Vercel:
1. Acesse: https://vercel.com
2. Vá no seu projeto
3. Clique em **"Deployments"** → Último deploy → **"Logs"**
4. Procure por erros relacionados a:
   - `FACEBOOK_CLIENT_ID`
   - `FACEBOOK_CLIENT_SECRET`
   - `NEXTAUTH_URL`
   - `access_token`
   - `whatsapp_business_account`

### No Console do Navegador:
1. Abra o DevTools (F12)
2. Vá na aba **"Console"**
3. Procure por erros em vermelho

---

## ❌ Possíveis Problemas e Soluções

### Erro: "FACEBOOK_CLIENT_ID não configurado"
**Causa:** Variável não configurada na Vercel  
**Solução:**
1. Vá em Vercel → Settings → Environment Variables
2. Adicione `FACEBOOK_CLIENT_ID` com o valor correto
3. Faça redeploy

### Erro: "redirect_uri_mismatch"
**Causa:** URL de callback não configurada no Meta  
**Solução:**
1. Meta for Developers → Login do Facebook → Configurações
2. Adicione: `https://autoflow.dev.br/api/whatsapp/facebook-callback`
3. Salve

### Erro: "Não foi possível obter WhatsApp Business Account ID"
**Causa:** Permissões não aprovadas ou conta não configurada  
**Solução:**
1. Verifique se as permissões foram aprovadas no Meta
2. Verifique se a conta tem WhatsApp Business configurado
3. Verifique se o número está verificado

### Erro: "Nenhum número de telefone encontrado"
**Causa:** Conta não tem número verificado  
**Solução:**
1. Acesse: https://business.facebook.com/
2. Vá em "Gerenciador do WhatsApp" → "Telefones"
3. Adicione e verifique um número

### Erro: "Instância não encontrada"
**Causa:** Problema no banco de dados ou sessão  
**Solução:**
1. Verifique se está logado
2. Verifique se a instância existe no banco
3. Tente criar uma nova instância

### Erro: "Access token inválido"
**Causa:** Token expirado ou inválido  
**Solução:**
1. Desconecte a instância
2. Reconecte via Facebook OAuth
3. Isso gerará um novo token

---

## ✅ Checklist Final (Sucesso)

Após todos os testes, você deve ter:

- [ ] ✅ Instância criada
- [ ] ✅ Conexão via Facebook OAuth funcionando
- [ ] ✅ Phone Number ID obtido
- [ ] ✅ Access Token obtido
- [ ] ✅ Status: "Conectado"
- [ ] ✅ Envio de mensagem funcionando
- [ ] ✅ Recebimento de mensagem funcionando
- [ ] ✅ Webhook funcionando (se configurado)

---

## 🎯 Próximos Passos

Se tudo estiver funcionando:

1. ✅ **Testar com cliente real** - Conecte uma conta de cliente
2. ✅ **Monitorar custos** - Acompanhe o uso no Meta
3. ✅ **Configurar billing centralizado** - Se ainda não configurou
4. ✅ **Remover console.log** - Limpar logs de debug
5. ✅ **Adicionar validações** - Melhorar segurança

---

## 📞 Precisa de Ajuda?

Se encontrar algum problema que não está nesta lista:

1. Verifique os logs no Vercel
2. Verifique o console do navegador
3. Verifique se todas as variáveis estão configuradas
4. Verifique se o app está publicado no Meta

---

**Boa sorte com os testes! 🚀**

