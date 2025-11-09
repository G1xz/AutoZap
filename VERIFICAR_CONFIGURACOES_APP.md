# 🔍 Verificar Configurações do App (Sem Publicar)

Mesmo sem publicar, você precisa verificar algumas configurações para `business_management` funcionar.

---

## ✅ Checklist de Configurações

### 1. Verificar Modo do App

1. Acesse: https://developers.facebook.com/
2. Abra seu app **AutoZap**
3. Vá em **"Configurações"** → **"Básico"**
4. Verifique o **"Modo do app"**:
   - ✅ Deve estar em **"Desenvolvimento"** (Development Mode)
   - ❌ Se estiver em "Desativado", ative para "Desenvolvimento"

---

### 2. Verificar Tipo do App

1. Em **"Configurações"** → **"Básico"**
2. Verifique o **"Tipo de app"**:
   - ✅ Deve ser **"Negócios"** (Business)
   - ❌ Se for "Consumidor", pode ter limitações

---

### 3. Adicionar Você como Administrador/Testador

**Isso é IMPORTANTE!** Sem isso, você não será reconhecido como testador.

1. No app, vá em **"Funções"** → **"Funções"** (ou "Roles" → "Roles")
2. Clique em **"Adicionar pessoas"** ou **"Add People"**
3. Adicione seu **e-mail do Facebook** ou **ID do Facebook**
4. Defina como **"Administrador"** ou **"Desenvolvedor"**
5. Salve

**Por que isso importa:**
- Usuários na lista de "Funções" são reconhecidos como testadores
- Podem usar permissões sem aprovação (em desenvolvimento)
- Você precisa estar nessa lista!

---

### 4. Verificar Verificação de Negócios (Business Verification)

Para `business_management`, pode ser necessário verificar seu negócio:

1. No app, vá em **"Configurações"** → **"Básico"**
2. Procure por **"Verificação de negócios"** ou **"Business Verification"**
3. Se aparecer como "Não verificado":
   - Clique em **"Iniciar verificação"**
   - Preencha os dados da sua empresa
   - Envie documentos (pode levar alguns dias)

**Nota:** Nem sempre é obrigatório, mas pode ser necessário para algumas permissões.

---

### 5. Verificar Permissões Adicionadas

1. Vá em **"Permissões e recursos"** (Permissions and Features)
2. Verifique se estas permissões estão na lista:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
   - `business_management` (se conseguir adicionar)

3. Se `business_management` não estiver:
   - Clique em **"Adicionar permissão"**
   - Digite `business_management`
   - Adicione
   - Tente solicitar aprovação

---

### 6. Verificar Status da Revisão

1. Vá em **"Revisão de aplicativo"** ou **"App Review"**
2. Verifique se há solicitações pendentes de `business_management`
3. Se houver, verifique o status:
   - **Pendente** = Aguardando revisão
   - **Aprovado** = Pode usar!
   - **Rejeitado** = Precisa corrigir e reenviar

---

## 🎯 O Que Fazer Agora

### Passo 1: Verificar Funções (MAIS IMPORTANTE)

1. Vá em **"Funções"** → **"Funções"**
2. Veja se seu e-mail está na lista
3. Se NÃO estiver:
   - Clique em **"Adicionar pessoas"**
   - Adicione seu e-mail
   - Defina como **"Administrador"**
   - Salve

### Passo 2: Tentar Adicionar business_management

1. Vá em **"Permissões e recursos"**
2. Clique em **"Adicionar permissão"**
3. Digite: `business_management`
4. Adicione
5. Tente solicitar aprovação

### Passo 3: Testar Novamente

Após adicionar você nas funções:
1. Aguarde alguns minutos
2. Teste a conexão novamente
3. Deve funcionar em modo de desenvolvimento

---

## ⚠️ Se Ainda Não Funcionar

Pode ser necessário:

1. **Verificação de Negócios** (Business Verification)
   - Pode levar alguns dias
   - Mas não precisa publicar o app

2. **Revisão da Meta**
   - Solicite `business_management` para revisão
   - Pode levar alguns dias para aprovar
   - Mas não precisa publicar o app

---

## ✅ Resumo

- ❌ **NÃO precisa publicar** o app
- ✅ **PRECISA** adicionar você nas "Funções" como Administrador
- ✅ **PRECISA** adicionar `business_management` nas permissões
- ⚠️ **PODE PRECISAR** de verificação de negócios (mas não é sempre obrigatório)

**Comece verificando as "Funções"!** Isso é o mais importante! 🎯

