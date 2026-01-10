# 🔑 Token Temporário vs Permanente - O Que Fazer Agora

## ⚠️ Token Gerado na Interface do Meta

Se você gerou o token selecionando o número de teste na configuração da API, ele **pode ser temporário ou permanente**, dependendo de como você gerou.

---

## 🔍 Como Saber se é Temporário ou Permanente?

### Tokens Temporários:
- ⏰ **Expira em 24 horas**
- 🧪 Apenas para testes
- ❌ Não serve para produção

### Tokens Permanentes:
- ✅ **Nunca expira** (ou expira em muito tempo)
- ✅ Serve para produção
- ✅ Ideal para usar no sistema

---

## 🎯 O Que Fazer Agora

### Opção 1: Verificar se o Token é Permanente

1. **No Meta for Developers:**
   - Vá em **WhatsApp** → **Configuração Inicial**
   - Procure pelo token que você gerou
   - Veja se tem indicação de expiração

2. **Se for temporário:**
   - Você precisa gerar um **token permanente**
   - Veja como abaixo 👇

### Opção 2: Gerar Token Permanente (Recomendado)

Para produção, você precisa de um **token permanente**. Veja como gerar:

#### Método 1: Via Meta for Developers (Mais Simples)

1. Acesse: https://developers.facebook.com/
2. Vá no seu app → **WhatsApp** → **Configuração Inicial**
3. Role até **"Token de acesso"** ou **"Access Token"**
4. Clique em **"Gerar token"** ou **"Renovar token"**
5. **Importante:** Selecione **"Token permanente"** ou **"Nunca expira"**
6. Selecione sua **Meta Business Account**
7. Selecione sua **WhatsApp Business Account**
8. Clique em **"Gerar token"**
9. **Copie o token** (você só verá ele uma vez!)

#### Método 2: Via Meta Business Suite (Mais Confiável)

1. Acesse: https://business.facebook.com/
2. Vá em **"Usuários"** → **"Usuários do sistema"**
3. Clique em **"Adicionar"** para criar um novo usuário do sistema
4. Dê um nome (ex: "AutoZap System User")
5. Atribua a função de **"Administrador"**
6. Clique em **"Criar usuário do sistema"**
7. Selecione o usuário criado e clique em **"Atribuir ativos"**
8. Escolha **"Aplicativos"** e selecione seu app do WhatsApp
9. Conceda **"Controle total"** e salve
10. Ainda na página do usuário, clique em **"Gerar novo token"**
11. Selecione seu app
12. Defina expiração como **"Nunca"** ou **"Permanente"**
13. Marque as permissões:
    - `whatsapp_business_management`
    - `whatsapp_business_messaging`
    - `business_management`
14. Clique em **"Gerar token"**
15. **Copie o token** (só aparece uma vez!)

---

## ✅ Passo 2: Configurar Token no Sistema

Agora que você tem o token permanente, configure no sistema:

### Opção A: Via Variável de Ambiente (Recomendado)

1. **No Vercel:**
   - Vá em **Settings** → **Environment Variables**
   - Adicione: `META_ACCESS_TOKEN`
   - Cole o token permanente
   - Salve

2. **Faça redeploy:**
   - Vá em **Deployments**
   - Clique nos 3 pontinhos do último deploy
   - Clique em **"Redeploy"**

### Opção B: Configurar na Instância (Alternativa)

1. No sistema, vá na instância que você criou
2. Clique em **"Configurar API"** ou **"Editar"**
3. Cole o token permanente no campo **"Access Token"**
4. Salve

**⚠️ Importante:** O sistema prioriza o token do `.env` (`META_ACCESS_TOKEN`), então se você configurar lá, ele será usado para todas as instâncias automaticamente.

---

## 🔄 Como o Sistema Usa o Token

O sistema funciona assim:

1. **Primeiro:** Tenta usar `META_ACCESS_TOKEN` do `.env` (se configurado)
2. **Segundo:** Usa o token da instância (se não tiver no .env)

**Recomendação:** Configure `META_ACCESS_TOKEN` no Vercel para usar o mesmo token em todas as instâncias!

---

## 🧪 Testar se Funcionou

1. **Envie uma mensagem de teste:**
   - Vá no sistema
   - Tente enviar uma mensagem
   - Verifique se funciona

2. **Verifique os logs:**
   - Se der erro, veja os logs no Vercel
   - Procure por erros relacionados a token

---

## ❌ Se o Token Expirar

Se você usar um token temporário e ele expirar:

1. **Erro comum:** "Invalid access token" ou "Token expirado"
2. **Solução:** Gere um novo token permanente e configure novamente

---

## ✅ Checklist

- [ ] Verificar se o token atual é temporário ou permanente
- [ ] Se for temporário: gerar token permanente
- [ ] Configurar `META_ACCESS_TOKEN` no Vercel
- [ ] Fazer redeploy
- [ ] Testar envio de mensagem
- [ ] Verificar se funciona

---

## 💡 Dica

**Para produção, sempre use token permanente!** 

Tokens temporários são apenas para testes rápidos. Como seu app já está aprovado, você pode usar token permanente sem problemas! 🚀

---

## 📞 Próximos Passos

Depois de configurar o token permanente:

1. ✅ Teste enviar uma mensagem
2. ✅ Teste receber uma mensagem
3. ✅ Verifique se tudo está funcionando
4. ✅ Se funcionar, está pronto para produção!

