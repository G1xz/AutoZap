# 🔑 Adicionar Token Permanente no Sistema

Seu token permanente está pronto! Agora vamos configurá-lo no sistema.

---

## ✅ Passo 1: Adicionar no .env

Adicione estas variáveis no seu arquivo `.env` na raiz do projeto:

```env
# Token Permanente (mesmo para todos os números)
META_ACCESS_TOKEN=EAAdQJocKhiwBP7ukE5QyzgDAPlBxdonSybKncSbjneSMjXTSe4ZBasFxSDEGI6fapTgSzDzAWypXC0ZBZCEQLpBNIyIISurXhk57lUZADksvYB9X4SGQO4TTTZCTvy64hyfSpnwGa0VvCovlUk5ZBZAAUE68UuEqzkSQrPlczmioD4XSWaHF6zAuvBt9i2cNG1oNwZDZD

# App ID (mesmo para todos)
META_APP_ID=2058451241567788

# Business Account ID (mesmo para todos - se você tiver)
META_BUSINESS_ACCOUNT_ID=898944883296416
```

**Importante:**
- ✅ Substitua o token acima pelo seu token real
- ✅ Não commite o `.env` no Git (já deve estar no `.gitignore`)
- ✅ Guarde o token com segurança

---

## ✅ Passo 2: Usar o Mesmo Token em Todas as Instâncias

### Opção A: Configuração Manual (Atual)

Quando criar uma nova instância:

1. No sistema, vá em **"Instâncias WhatsApp"**
2. Crie uma nova instância
3. Clique em **"Configurar API"**
4. Preencha:
   - **Phone Number ID**: (específico de cada número)
   - **Access Token**: Cole o mesmo token permanente em todas
   - **App ID**: Use o mesmo App ID em todas
   - **Business Account ID**: Use o mesmo em todas

### Opção B: Via Facebook OAuth (Automático)

Quando conectar via Facebook OAuth:

1. O sistema obtém automaticamente o token do OAuth
2. Mas você pode editar depois e colocar o token permanente
3. Ou deixar o token do OAuth (também funciona)

---

## ✅ Passo 3: Verificar se Está Funcionando

1. Reinicie o servidor (se estiver rodando localmente):
   ```bash
   # Pare o servidor (Ctrl+C)
   npm run dev
   ```

2. Teste enviando uma mensagem:
   - Crie uma instância
   - Configure com o token permanente
   - Teste enviar uma mensagem

---

## 💡 Dicas

### Token Permanente vs Token OAuth

- **Token Permanente** (que você tem):
  - ✅ Não expira
  - ✅ Funciona para todos os números da sua conta
  - ✅ Ideal para testes e produção
  - ✅ Você controla tudo

- **Token OAuth** (obtido via Facebook):
  - ⚠️ Pode expirar (depende do tipo)
  - ✅ Obtido automaticamente
  - ✅ Funciona bem também

**Recomendação:** Use o token permanente para tudo!

### Usar o Mesmo Token para Todos

Você pode usar o **mesmo token permanente** para:
- ✅ Todos os números da sua conta Meta Business
- ✅ Todas as instâncias que você criar
- ✅ Todos os testes

**Só muda:**
- Phone Number ID (cada número tem o seu)

---

## 🔒 Segurança

1. **Não compartilhe o token** publicamente
2. **Não commite** no Git
3. **Guarde** em variáveis de ambiente
4. **Se expor**, revogue e gere um novo

---

## ✅ Checklist

- [ ] Token permanente adicionado no `.env`
- [ ] App ID adicionado no `.env`
- [ ] Business Account ID adicionado no `.env` (se tiver)
- [ ] Servidor reiniciado (se necessário)
- [ ] Testado com uma instância

---

Pronto! Agora você tem o token permanente configurado! 🚀

