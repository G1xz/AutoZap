# 🚀 Como Publicar o App no Meta/Facebook (Para Usar Números Reais)

Este guia explica como publicar seu app no Meta for Developers para poder usar números reais do WhatsApp (não apenas números de teste).

---

## 🎯 Por Que Publicar?

**Situação Atual:**
- ❌ App em modo de desenvolvimento/teste
- ❌ Só consegue usar números de teste
- ❌ Não pode usar números reais de clientes

**Após Publicar:**
- ✅ Pode usar números reais
- ✅ Clientes podem conectar seus números
- ✅ Sistema funciona em produção

---

## 📋 Pré-requisitos

Antes de publicar, você precisa ter:

1. ✅ App criado no Meta for Developers
2. ✅ Facebook Login configurado
3. ✅ Permissões WhatsApp solicitadas
4. ✅ App funcionando em desenvolvimento
5. ✅ Política de Privacidade (URL pública)
6. ✅ Termos de Serviço (URL pública) - opcional mas recomendado
7. ✅ Ícone do app (1024x1024px)
8. ✅ Descrição do app

---

## 🔧 Passo 1: Preparar Informações do App

### 1.1 Política de Privacidade

**Você PRECISA ter uma URL pública com sua política de privacidade.**

**Opções:**
1. Criar uma página no seu site (recomendado)
2. Usar um gerador online (ex: https://www.privacypolicygenerator.info/)
3. Criar um arquivo HTML simples e hospedar

**O que deve conter:**
- Como você coleta dados
- Como você usa os dados
- Como você armazena os dados
- Direitos dos usuários
- Contato para dúvidas

**Exemplo de URL:**
```
https://seu-dominio.com/privacy-policy
```

### 1.2 Termos de Serviço (Opcional mas Recomendado)

Similar à política de privacidade, mas descrevendo:
- Como o serviço funciona
- Responsabilidades
- Limitações

**Exemplo de URL:**
```
https://seu-dominio.com/terms-of-service
```

### 1.3 Ícone do App

- Tamanho: 1024x1024 pixels
- Formato: PNG ou JPG
- Deve representar seu app/serviço

### 1.4 Descrição do App

Prepare uma descrição clara explicando:
- O que seu app faz
- Para quem é destinado
- Como funciona

**Exemplo:**
```
AutoZap é uma plataforma de automação de conversas para WhatsApp. 
Permite que empresas criem fluxos automatizados de atendimento, 
agendamentos e vendas através do WhatsApp Business API.
```

---

## 📝 Passo 2: Preencher Informações Básicas do App

1. Acesse: https://developers.facebook.com/
2. Clique em **"Meus Apps"** → Selecione seu app
3. Vá em **"Configurações"** → **"Básico"**

### Preencha:

- **Nome de exibição do app**: Nome que aparece para usuários
- **Categoria**: Selecione a mais adequada (ex: "Negócios", "Produtividade")
- **Domínio do app**: Seu domínio (ex: `seu-dominio.com`)
- **URL da política de privacidade**: URL pública da sua política
- **URL dos termos de serviço**: (Opcional) URL dos termos
- **E-mail de contato**: Seu e-mail
- **Ícone do app**: Faça upload do ícone (1024x1024px)

---

## 🔐 Passo 3: Configurar Permissões e Revisão

### 3.1 Verificar Permissões Necessárias

1. Vá em **"Permissões e recursos"** (Permissions and Features)
2. Verifique se tem as seguintes permissões:
   - `business_management`
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
   - `pages_read_engagement`
   - `pages_manage_metadata`

### 3.2 Solicitar Revisão das Permissões

**⚠️ IMPORTANTE:** Para usar em produção, você precisa que a Meta **revise e aprove** as permissões.

1. Para cada permissão que precisa de revisão:
   - Clique na permissão
   - Clique em **"Solicitar revisão"** ou **"Request Review"**
   - Preencha o formulário explicando:
     - **Como você usa a permissão**: Descreva o que seu app faz
     - **Por que precisa da permissão**: Explique a necessidade
     - **Como o usuário se beneficia**: Explique os benefícios
     - **Screenshots/Vídeo**: Mostre como funciona (opcional mas ajuda)

**Exemplo de explicação:**
```
Nosso app permite que empresas automatizem conversas no WhatsApp. 
Usamos whatsapp_business_messaging para enviar respostas automáticas 
aos clientes e whatsapp_business_management para gerenciar múltiplas 
contas de negócios. Isso permite que nossos clientes atendam seus 
clientes 24/7 sem precisar estar online manualmente.
```

### 3.3 Informações Adicionais para Revisão

A Meta pode pedir:
- **Vídeo de demonstração**: Mostre o app funcionando
- **Screenshots**: Imagens do app em uso
- **URL de teste**: Onde podem testar o app
- **Instruções de teste**: Como testar o app

**Dica:** Seja o mais detalhado possível. Isso aumenta as chances de aprovação.

---

## 🌐 Passo 4: Configurar URLs de Produção

### 4.1 URLs de Redirecionamento OAuth

1. Vá em **"Facebook Login"** → **"Configurações"**
2. Adicione a URL de produção:
   ```
   https://seu-dominio.com/api/whatsapp/facebook-callback
   ```
3. Mantenha também a de desenvolvimento (se necessário):
   ```
   http://localhost:3000/api/whatsapp/facebook-callback
   ```

### 4.2 Domínios do App

1. Vá em **"Configurações"** → **"Básico"**
2. Em **"Domínios do app"**, adicione:
   - `seu-dominio.com`
   - `www.seu-dominio.com` (se usar)

---

## 📱 Passo 5: Configurar WhatsApp para Produção

### 5.1 Verificar Configuração do WhatsApp

1. Vá em **"WhatsApp"** → **"Configuração"**
2. Verifique se está tudo configurado:
   - ✅ Token de acesso (permanente)
   - ✅ Webhook configurado
   - ✅ Números de telefone adicionados

### 5.2 Migrar de Número de Teste para Produção

**Antes de publicar:**
- Você pode estar usando um número de teste
- Números de teste só funcionam com tokens de desenvolvimento

**Após publicar:**
1. Adicione números reais na sua conta Meta Business
2. Obtenha o Phone Number ID de cada número
3. Configure no sistema usando tokens permanentes

---

## 🚀 Passo 6: Submeter App para Revisão

### 6.1 Verificar Checklist Antes de Submeter

- [ ] Política de privacidade publicada e acessível
- [ ] Termos de serviço (opcional mas recomendado)
- [ ] Ícone do app adicionado
- [ ] Descrição do app preenchida
- [ ] URLs de produção configuradas
- [ ] Permissões solicitadas para revisão
- [ ] App funcionando corretamente
- [ ] Vídeo/screenshots preparados (se necessário)

### 6.2 Submeter para Revisão

1. Vá em **"Revisão do App"** (App Review) no menu lateral
2. Clique em **"Criar solicitação"** ou **"Create Request"**
3. Selecione as permissões que quer revisar
4. Preencha todas as informações solicitadas
5. Envie screenshots/vídeo se pedido
6. Clique em **"Enviar para revisão"** ou **"Submit for Review"**

### 6.3 Aguardar Revisão

- ⏱️ **Tempo médio**: 3-7 dias úteis
- 📧 Você receberá e-mails sobre o status
- ✅ Se aprovado: Pode usar em produção
- ❌ Se negado: A Meta explicará o motivo e você pode corrigir e reenviar

---

## ✅ Passo 7: Após Aprovação

### 7.1 Verificar Status

1. Vá em **"Revisão do App"**
2. Verifique se as permissões foram aprovadas
3. Status deve mostrar **"Aprovado"** ou **"Approved"**

### 7.2 Mudar Modo do App

1. Vá em **"Configurações"** → **"Básico"**
2. Role até **"Modo do app"** (App Mode)
3. Mude de **"Desenvolvimento"** para **"Produção"** ou **"Live"**

**⚠️ IMPORTANTE:** Só mude para produção após ter certeza que tudo está funcionando!

### 7.3 Testar com Números Reais

1. Adicione um número real na sua conta Meta Business
2. Configure no sistema
3. Teste enviando/recebendo mensagens
4. Verifique se workflows estão funcionando

---

## 🚨 Problemas Comuns

### App Negado na Revisão

**O que fazer:**
1. Leia o feedback da Meta cuidadosamente
2. Corrija os problemas apontados
3. Adicione mais informações/explicações
4. Reenvie para revisão

**Problemas comuns:**
- Política de privacidade não acessível
- Explicação insuficiente do uso das permissões
- App não funciona durante o teste
- Falta de informações sobre como o usuário se beneficia

### Permissões Não Aprovadas

**O que fazer:**
1. Verifique se explicou bem o uso
2. Adicione screenshots/vídeo demonstrando
3. Forneça instruções claras de teste
4. Reenvie com mais detalhes

### Números Reais Não Funcionam

**Possíveis causas:**
- App ainda não está em modo produção
- Permissões não foram aprovadas
- Token não é permanente
- Número não foi adicionado corretamente na Meta Business

---

## 📚 Recursos Úteis

- [Guia de Revisão do App - Meta](https://developers.facebook.com/docs/app-review)
- [Políticas da Plataforma - Meta](https://developers.facebook.com/policy)
- [Guia de WhatsApp Business API](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)

---

## 💡 Dicas Importantes

1. **Seja detalhado**: Quanto mais informações você fornecer, melhor
2. **Teste antes**: Certifique-se que tudo funciona antes de submeter
3. **Seja paciente**: A revisão pode demorar alguns dias
4. **Documente tudo**: Mantenha screenshots e explicações organizadas
5. **Responda rápido**: Se a Meta pedir mais informações, responda rapidamente

---

## ✅ Checklist Final

Antes de submeter, verifique:

- [ ] Política de privacidade publicada e acessível
- [ ] Termos de serviço (opcional)
- [ ] Ícone do app (1024x1024px)
- [ ] Descrição do app completa
- [ ] URLs de produção configuradas
- [ ] Permissões solicitadas para revisão
- [ ] Explicações detalhadas sobre uso das permissões
- [ ] Screenshots/vídeo preparados
- [ ] App testado e funcionando
- [ ] Informações de contato atualizadas

---

## 🎉 Pronto!

Após seguir todos os passos e ter o app aprovado, você poderá:

- ✅ Usar números reais do WhatsApp
- ✅ Conectar clientes reais
- ✅ Operar em produção
- ✅ Escalar seu negócio

**Lembre-se:** O processo pode levar alguns dias, mas é necessário para usar em produção. Seja paciente e detalhado nas explicações!

---

**Última atualização:** 2025-01-27





