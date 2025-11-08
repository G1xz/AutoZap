# 🚀 Guia Passo a Passo: Criar App e Testar Conexão Facebook

Este guia te leva do zero até testar a conexão via Facebook OAuth.

**💡 Importante:** Se você já tem um app do AutoZap no Meta for Developers, você **NÃO precisa criar um app novo**! 
Consulte o guia `GUIA_ADICIONAR_FACEBOOK_LOGIN_APP_EXISTENTE.md` para adicionar Facebook Login ao app existente.

---

## 📋 Passo 1: Criar App no Meta for Developers

**⚠️ Só siga este passo se você NÃO tem um app ainda!**

### 1.1 Acessar Meta for Developers

1. Acesse: https://developers.facebook.com/
2. Faça login com sua conta Facebook/Meta Business
3. Se não tiver conta, crie uma em: https://www.facebook.com/

### 1.2 Criar Novo App

1. No canto superior direito, clique em **"Meus Apps"**
2. Clique em **"Criar App"**
3. Escolha o tipo: **"Negócios"** (Business)
4. Clique em **"Avançar"**

### 1.3 Preencher Informações do App

1. **Nome do App**: Digite um nome (ex: "AutoZap - Automação WhatsApp")
2. **E-mail de contato**: Seu e-mail
3. **Finalidade do app**: Selecione **"Automação de negócios"** ou **"Outro"**
4. Clique em **"Criar App"**

### 1.4 Verificar Segurança

- Pode pedir verificação de identidade (normal)
- Complete a verificação se solicitado

---

## ⚙️ Passo 2: Configurar Facebook Login

### 2.1 Adicionar Produto Facebook Login

1. No painel do app, clique em **"Adicionar produto"** (ou **"Add Product"**)
2. Procure por **"Facebook Login"**
3. Clique em **"Configurar"** (ou **"Set Up"**)

### 2.2 Configurar URLs de Redirecionamento

1. No menu lateral, vá em **"Facebook Login"** → **"Configurações"**
2. Role até **"URLs de redirecionamento OAuth válidas"**
3. Adicione as seguintes URLs (uma por linha):

```
http://localhost:3000/api/whatsapp/facebook-callback
https://seu-dominio.com/api/whatsapp/facebook-callback
```

**Importante:**
- Se estiver em desenvolvimento, use `http://localhost:3000`
- Se já tiver domínio em produção, adicione também
- Clique em **"Salvar alterações"**

---

## 🔑 Passo 3: Obter App ID e App Secret

### 3.1 Obter App ID

1. No menu lateral, vá em **"Configurações"** → **"Básico"**
2. Você verá o **"ID do aplicativo"** (App ID) no topo
3. **Copie este ID** - você precisará dele

### 3.2 Obter App Secret

1. Na mesma página, role até **"Chave secreta do aplicativo"** (App Secret)
2. Clique em **"Mostrar"** (pode pedir senha do Facebook)
3. **Copie o App Secret** - você só verá ele uma vez!
4. **Guarde com segurança!**

---

## 📝 Passo 4: Configurar Variáveis de Ambiente

### 4.1 Criar/Editar arquivo .env

No seu projeto, crie ou edite o arquivo `.env` na raiz:

```env
# Facebook OAuth
FACEBOOK_CLIENT_ID=seu_app_id_aqui
FACEBOOK_CLIENT_SECRET=seu_app_secret_aqui

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=sua_chave_secreta_aqui

# Database (já deve ter)
DATABASE_URL=sua_url_do_banco
```

### 4.2 Substituir Valores

- Substitua `seu_app_id_aqui` pelo App ID copiado
- Substitua `seu_app_secret_aqui` pelo App Secret copiado
- Se não tiver `NEXTAUTH_SECRET`, gere uma:
  ```bash
  openssl rand -base64 32
  ```

### 4.3 Reiniciar Servidor

Após adicionar as variáveis:
1. Pare o servidor (Ctrl+C)
2. Inicie novamente: `npm run dev`
3. As variáveis serão carregadas

---

## 🔐 Passo 5: Solicitar Permissões WhatsApp

### 5.1 Adicionar Permissões

1. No Meta for Developers, vá em **"Permissões e recursos"** (ou **"Permissions and Features"**)
2. Clique em **"Adicionar permissão"**
3. Adicione as seguintes permissões:

```
business_management
whatsapp_business_management
whatsapp_business_messaging
pages_read_engagement
pages_manage_metadata
```

### 5.2 Sobre Revisão da Meta

- ⚠️ Algumas permissões podem precisar de **revisão da Meta**
- ✅ Para **testes**, você pode usar em modo de desenvolvimento
- ✅ Adicione usuários de teste no app para testar sem revisão
- 📝 Para produção, você precisará solicitar revisão

### 5.3 Adicionar Usuários de Teste (Para Desenvolvimento)

1. Vá em **"Funções"** → **"Funções"** (ou **"Roles"** → **"Roles"**)
2. Clique em **"Adicionar pessoas"**
3. Adicione sua conta Facebook como **"Administrador"**
4. Isso permite testar sem revisão da Meta

---

## 🧪 Passo 6: Testar a Conexão

### 6.1 Preparar Conta de Teste

Para testar, você precisa:

1. ✅ Ter uma conta **Meta Business**
2. ✅ Ter um **WhatsApp Business Account** configurado
3. ✅ Ter pelo menos um **número de telefone** verificado

### 6.2 Criar Instância no Sistema

1. Acesse seu sistema: `http://localhost:3000`
2. Faça login
3. Vá em **"Instâncias WhatsApp"**
4. Crie uma nova instância (ex: "Teste Facebook")
5. Clique em **"Criar Número"**

### 6.3 Conectar via Facebook

1. Na instância criada, clique em **"🔵 Conectar via Facebook"**
2. Uma janela/modal abrirá
3. Clique em **"Conectar com Facebook"**
4. Uma nova janela abrirá pedindo autorização do Facebook
5. Faça login no Facebook (se não estiver logado)
6. Autorize todas as permissões solicitadas
7. Aguarde o redirecionamento

### 6.4 Verificar Conexão

Após autorizar:

1. Você será redirecionado de volta para o dashboard
2. A instância deve estar com status **"Conectado"**
3. Verifique se aparecem:
   - ✅ Phone Number ID
   - ✅ Número de telefone
   - ✅ Status: "Conectado"

---

## 🚨 Problemas Comuns e Soluções

### Erro "App ID não configurado"

**Solução:**
- Verifique se `FACEBOOK_CLIENT_ID` está no `.env`
- Reinicie o servidor após adicionar
- Verifique se não há espaços extras no `.env`

### Erro "URL de redirecionamento inválida"

**Solução:**
- Verifique se a URL está exatamente igual no Meta for Developers
- URLs devem ser idênticas (com/sem barra final importa)
- Use `http://localhost:3000` (não `http://localhost:3000/`)

### Erro "Permissões negadas"

**Solução:**
- Cliente precisa autorizar TODAS as permissões
- Verifique se as permissões foram adicionadas no app
- Tente novamente autorizando todas

### Erro "Nenhuma conta de negócios encontrada"

**Solução:**
- Você precisa ter uma conta Meta Business
- Crie em: https://business.facebook.com/
- Vincule sua conta Facebook à Meta Business

### Erro "Nenhum número de telefone encontrado"

**Solução:**
- Você precisa ter WhatsApp Business configurado
- Adicione um número na sua conta Meta Business
- Número precisa estar verificado

---

## ✅ Checklist Final

Antes de testar, verifique:

- [ ] App criado no Meta for Developers
- [ ] Facebook Login configurado
- [ ] URLs de redirecionamento adicionadas
- [ ] App ID copiado
- [ ] App Secret copiado
- [ ] Variáveis de ambiente configuradas (`.env`)
- [ ] Servidor reiniciado após adicionar variáveis
- [ ] Permissões WhatsApp adicionadas
- [ ] Conta Meta Business criada
- [ ] WhatsApp Business Account configurado
- [ ] Número de telefone verificado

---

## 🎯 Próximos Passos

Após testar com sucesso:

1. ✅ Teste com sua própria conta primeiro
2. ✅ Depois teste com contas de clientes
3. ✅ Configure webhook (se necessário)
4. ✅ Solicite revisão da Meta para produção (se necessário)

---

## 📚 Links Úteis

- [Meta for Developers](https://developers.facebook.com/)
- [Meta Business Suite](https://business.facebook.com/)
- [Documentação Facebook Login](https://developers.facebook.com/docs/facebook-login)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp/cloud-api)

---

## 🎉 Pronto para Testar!

Siga os passos acima e me avise se encontrar algum problema. Vamos fazer funcionar! 🚀

