# 📡 Como Configurar Webhook no Meta for Developers

Guia rápido para preencher URL de callback e token de verificação.

---

## 🎯 O Que Você Precisa

1. **URL de Callback**: URL do seu sistema + ID da instância
2. **Token de Verificação**: Token gerado pelo sistema

---

## 📋 Passo 1: Obter URL de Callback

### URL Base:
```
https://auto-zap-snsb.vercel.app/api/whatsapp/webhook
```

### URL Completa (com ID da instância):
```
https://auto-zap-snsb.vercel.app/api/whatsapp/webhook?instanceId=ID_DA_INSTANCIA
```

### Como Obter o ID da Instância:

**Opção 1: No Sistema**
1. Acesse: https://auto-zap-snsb.vercel.app/dashboard
2. Vá em "Instâncias WhatsApp"
3. Encontre sua instância conectada
4. O ID aparece na URL ou você pode ver no código da página

**Opção 2: Se Conectou via OAuth**
- O ID foi gerado automaticamente
- Está salvo no banco de dados
- Você pode ver no sistema

---

## 📋 Passo 2: Obter Token de Verificação

### Como Obter:

**Opção 1: No Sistema (Mais Fácil)**
1. Acesse: https://auto-zap-snsb.vercel.app/dashboard
2. Vá em "Instâncias WhatsApp"
3. Encontre sua instância
4. Procure por "Token de Verificação" ou "Webhook Verify Token"
5. Clique em "Copiar Token"
6. Cole no Meta for Developers

**Opção 2: Se Conectou via OAuth**
- O token foi gerado automaticamente
- Está salvo na instância
- Você pode ver no sistema

**Opção 3: Gerar Novo Token**
- Se não tiver token, o sistema gera automaticamente ao configurar
- Ou você pode criar um token manualmente

---

## 📋 Passo 3: Preencher no Meta for Developers

### 1. URL de Callback:
```
https://auto-zap-snsb.vercel.app/api/whatsapp/webhook?instanceId=SEU_ID_AQUI
```
(Substitua `SEU_ID_AQUI` pelo ID real da sua instância)

### 2. Verificar Token:
```
COLE_O_TOKEN_AQUI
```
(Use o token obtido no Passo 2)

### 3. Marcar Eventos:
- ✅ **messages** (mensagens recebidas)
- ✅ **messaging_postbacks** (respostas de botões)

### 4. Clicar em "Verificar e salvar"

---

## 🔍 Se Não Souber o ID da Instância

### Método 1: Ver no Sistema
1. Acesse o dashboard
2. Abra o console do navegador (F12)
3. Procure por "instanceId" nas requisições
4. Ou veja na URL quando abrir configuração

### Método 2: Ver no Banco de Dados
- Se tiver acesso ao banco, veja a tabela `WhatsAppInstance`
- O campo `id` é o ID da instância

### Método 3: Criar Nova Instância
- Se não souber, crie uma nova instância
- O ID será gerado automaticamente
- Use esse ID na URL do webhook

---

## 💡 Dica Rápida

**Se você conectou via OAuth:**
1. O sistema já gerou tudo automaticamente
2. Só precisa pegar no sistema:
   - ID da instância
   - Token de verificação
3. Cole no Meta for Developers

---

## ✅ Resumo

**URL de Callback:**
```
https://auto-zap-snsb.vercel.app/api/whatsapp/webhook?instanceId=ID_DA_INSTANCIA
```

**Token de Verificação:**
- Obter no sistema (Instâncias WhatsApp → Token de Verificação)
- Ou gerar novo se necessário

**Próximo Passo:**
- Acesse o sistema e pegue essas informações! 🚀




