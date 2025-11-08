# 🔧 Guia: Adicionar Facebook Login ao App Existente

Se você já tem um app do AutoZap no Meta for Developers, você **NÃO precisa criar um app novo**! Só precisa adicionar o produto "Facebook Login" ao app existente.

---

## ✅ Você Pode Usar o App Existente!

**Vantagens:**
- ✅ Não precisa criar app novo
- ✅ Mantém tudo centralizado
- ✅ Usa o mesmo App ID e App Secret
- ✅ Mais simples de gerenciar

---

## 📋 Passo a Passo

### Passo 1: Acessar seu App Existente

1. Acesse: https://developers.facebook.com/
2. Faça login
3. Clique em **"Meus Apps"**
4. Selecione seu app do **AutoZap** (o que você já tem)

### Passo 2: Adicionar Produto Facebook Login

1. No painel do app, procure por **"Adicionar produto"** (ou **"Add Product"**)
2. Procure por **"Facebook Login"**
3. Clique em **"Configurar"** (ou **"Set Up"**)

**Nota:** Se já tiver Facebook Login adicionado, pule para o Passo 3.

### Passo 3: Configurar URLs de Redirecionamento

1. No menu lateral, vá em **"Facebook Login"** → **"Configurações"**
2. Role até **"URLs de redirecionamento OAuth válidas"**
3. Adicione a URL do callback:

```
http://localhost:3000/api/whatsapp/facebook-callback
```

**Se já tiver URLs configuradas:**
- Adicione a nova URL na lista
- Ou substitua se for a mesma aplicação

4. Clique em **"Salvar alterações"**

### Passo 4: Obter App ID e App Secret (se ainda não tiver)

1. Vá em **"Configurações"** → **"Básico"**
2. Copie o **"ID do aplicativo"** (App ID)
3. Copie o **"Chave secreta do aplicativo"** (App Secret)
   - Clique em **"Mostrar"** se necessário

### Passo 5: Adicionar Variáveis de Ambiente

No seu arquivo `.env`, adicione:

```env
FACEBOOK_CLIENT_ID=seu_app_id_do_autozap
FACEBOOK_CLIENT_SECRET=seu_app_secret_do_autozap
```

**Importante:** Use o App ID e App Secret do seu app existente do AutoZap!

### Passo 6: Solicitar Permissões WhatsApp (se ainda não tiver)

1. Vá em **"Permissões e recursos"** (ou **"Permissions and Features"**)
2. Adicione as permissões:
   - `business_management`
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
   - `pages_read_engagement`
   - `pages_manage_metadata`

3. Salve as alterações

### Passo 7: Reiniciar Servidor

Após adicionar as variáveis de ambiente:

```bash
# Pare o servidor (Ctrl+C)
npm run dev
```

---

## ✅ Pronto!

Agora você pode usar o mesmo app do AutoZap para conectar via Facebook OAuth!

---

## 🎯 Resumo

**O que você precisa fazer:**
1. ✅ Adicionar produto "Facebook Login" ao app existente
2. ✅ Configurar URL de redirecionamento
3. ✅ Adicionar variáveis de ambiente (App ID e Secret do app existente)
4. ✅ Solicitar permissões WhatsApp (se ainda não tiver)
5. ✅ Reiniciar servidor

**O que você NÃO precisa fazer:**
- ❌ Criar app novo
- ❌ Obter novos App ID/Secret
- ❌ Configurar tudo do zero

---

## 💡 Vantagens de Usar o App Existente

- ✅ Tudo centralizado em um app só
- ✅ Mais fácil de gerenciar
- ✅ Menos configuração
- ✅ Usa credenciais que você já tem

---

## 🚨 Importante

**Se o app existente já tem WhatsApp configurado:**
- ✅ Perfeito! Só adiciona Facebook Login
- ✅ As permissões WhatsApp podem já estar lá
- ✅ Só precisa adicionar as URLs de redirecionamento

**Se o app existente não tem WhatsApp:**
- ✅ Adicione o produto "WhatsApp" também
- ✅ Configure WhatsApp no app
- ✅ Depois adicione Facebook Login

---

Pronto! É só adicionar Facebook Login ao app que você já tem! 🎉

