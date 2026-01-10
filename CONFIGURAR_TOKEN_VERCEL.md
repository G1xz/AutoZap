# ✅ Configurar Token Permanente no Vercel - Passo a Passo

Agora que você gerou o token permanente, vamos configurá-lo no Vercel!

---

## 📋 Passo 1: Adicionar Variável no Vercel

1. **Acesse:** https://vercel.com
2. Faça login e vá no seu projeto
3. Clique em **"Settings"** (Configurações)
4. No menu lateral, clique em **"Environment Variables"** (Variáveis de Ambiente)
5. Clique em **"Add New"** ou **"Adicionar Nova"**

### Preencher:
- **Name (Nome):** `META_ACCESS_TOKEN`
- **Value (Valor):** Cole o token permanente que você gerou
- **Environment (Ambiente):** Selecione **"Production"** (e também "Preview" e "Development" se quiser)

6. Clique em **"Save"** ou **"Salvar"**

---

## 📋 Passo 2: Fazer Redeploy

Após adicionar a variável, você precisa fazer redeploy para ela ser aplicada:

1. No Vercel, vá em **"Deployments"** (Implantações)
2. Encontre o último deploy
3. Clique nos **3 pontinhos** (⋯) do último deploy
4. Clique em **"Redeploy"**
5. Aguarde o deploy terminar (pode levar 1-2 minutos)

---

## ✅ Passo 3: Verificar se Funcionou

### Opção A: Testar Enviando Mensagem

1. Acesse: `https://autoflow.dev.br/dashboard`
2. Vá na instância que você criou
3. Tente enviar uma mensagem de teste
4. Verifique se funciona

### Opção B: Verificar nos Logs

1. No Vercel, vá em **"Deployments"**
2. Clique no último deploy
3. Clique em **"Logs"**
4. Procure por erros relacionados a token

**Se aparecer erro:** "META_ACCESS_TOKEN não encontrado"
- Verifique se adicionou a variável corretamente
- Verifique se fez redeploy
- Verifique se o nome está exatamente: `META_ACCESS_TOKEN`

---

## 🔍 Como o Sistema Usa o Token

O sistema funciona assim:

1. **Primeiro:** Tenta usar `META_ACCESS_TOKEN` do Vercel (que você acabou de configurar)
2. **Se não encontrar:** Tenta usar o token da instância (se configurado manualmente)

**Com o token no Vercel:**
- ✅ Todas as instâncias usam o mesmo token automaticamente
- ✅ Não precisa configurar token em cada instância
- ✅ Mais fácil de gerenciar

---

## ✅ Checklist

- [ ] Token permanente gerado
- [ ] Variável `META_ACCESS_TOKEN` adicionada no Vercel
- [ ] Valor do token colado corretamente
- [ ] Ambiente selecionado (Production)
- [ ] Redeploy feito
- [ ] Teste de envio de mensagem realizado
- [ ] Funcionou! ✅

---

## 🎯 Próximos Passos

Depois que o token estiver configurado e funcionando:

1. ✅ **Testar envio de mensagem** - Verificar se envia corretamente
2. ✅ **Testar recebimento** - Verificar se recebe mensagens
3. ✅ **Testar com número real** - Se ainda estiver usando número de teste, migre para número real
4. ✅ **Pronto para produção!** - Começar a usar com clientes

---

## ❌ Se Não Funcionar

### Erro: "META_ACCESS_TOKEN não encontrado"

**Soluções:**
1. Verifique se o nome da variável está exatamente: `META_ACCESS_TOKEN` (maiúsculas)
2. Verifique se fez redeploy após adicionar a variável
3. Verifique se selecionou o ambiente correto (Production)

### Erro: "Invalid access token"

**Soluções:**
1. Verifique se o token foi copiado completamente (sem espaços)
2. Verifique se o token não expirou (se for temporário)
3. Gere um novo token permanente se necessário

---

**Pronto! Configure o token no Vercel e faça o redeploy! 🚀**

