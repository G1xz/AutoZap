# 🧪 Teste: Conexão via Facebook OAuth

Após o redeploy, vamos testar se tudo está funcionando!

---

## ✅ Checklist Antes de Testar

- [ ] Variáveis configuradas na Vercel (NEXTAUTH_URL, FACEBOOK_CLIENT_ID, FACEBOOK_CLIENT_SECRET, etc.)
- [ ] Redeploy concluído
- [ ] URL configurada no Meta for Developers: `https://auto-zap-snsb.vercel.app/api/whatsapp/facebook-callback`
- [ ] "Forçar HTTPS" ativado no Meta

---

## 🧪 Passo 1: Acessar o Sistema

1. Acesse: `https://auto-zap-snsb.vercel.app/dashboard`
2. Faça login (ou crie uma conta se necessário)

---

## 🧪 Passo 2: Criar Instância WhatsApp

1. No dashboard, vá em **"Instâncias WhatsApp"** (ou similar)
2. Clique em **"Criar Nova Instância"** ou **"Adicionar Instância"**
3. Dê um nome (ex: "Teste Facebook OAuth")
4. Salve

---

## 🧪 Passo 3: Conectar via Facebook

1. Encontre a instância que você criou
2. Procure pelo botão **"🔵 Conectar via Facebook"** ou **"Conectar via Facebook"**
3. Clique no botão

---

## 🧪 Passo 4: Autorizar no Facebook

1. Uma nova janela/aba deve abrir com a tela de autorização do Facebook
2. Faça login no Facebook (se necessário)
3. Revise as permissões solicitadas:
   - Gerenciar negócios
   - WhatsApp Business Management
   - WhatsApp Business Messaging
   - etc.
4. Clique em **"Continuar"** ou **"Autorizar"**

---

## 🧪 Passo 5: Verificar Conexão

Após autorizar:

1. Você deve ser redirecionado de volta para o sistema
2. A instância deve mostrar status **"Conectado"** ou **"Connected"**
3. Deve aparecer informações como:
   - Phone Number ID
   - Business Account ID
   - Status: Conectado

---

## ✅ O Que Esperar (Sucesso)

- ✅ Redirecionamento funciona
- ✅ Instância conectada
- ✅ Credenciais obtidas automaticamente
- ✅ Status: "Conectado"

---

## ❌ Possíveis Problemas

### Erro: "config_missing"
- **Causa:** Variáveis não configuradas na Vercel
- **Solução:** Verifique se todas as variáveis estão na Vercel e faça redeploy

### Erro: "redirect_uri_mismatch"
- **Causa:** URL não configurada corretamente no Meta
- **Solução:** Verifique se a URL está exatamente como: `https://auto-zap-snsb.vercel.app/api/whatsapp/facebook-callback`

### Erro: "invalid_client"
- **Causa:** FACEBOOK_CLIENT_ID ou FACEBOOK_CLIENT_SECRET incorretos
- **Solução:** Verifique se os valores estão corretos na Vercel

### Não abre a tela de autorização
- **Causa:** Erro ao gerar URL de autorização
- **Solução:** Verifique os logs da Vercel (Deployments → View Function Logs)

---

## 🎯 Próximos Passos Após Funcionar

1. ✅ Testar envio de mensagem
2. ✅ Configurar webhook (se necessário)
3. ✅ Testar recebimento de mensagens

---

Vamos testar! Me avise o resultado! 🚀

