# 🔧 Solução: HTTPS Forçado (Não Pode Desativar)

O "Forçar HTTPS" está ativado e não pode ser desativado. Mas há uma solução!

---

## ✅ Solução: Verificar Modo de Desenvolvimento

A dica diz: *"Os redirecionamentos de http://localhost são permitidos automaticamente somente no modo de desenvolvimento"*

Isso significa que você precisa garantir que o app está em **modo de desenvolvimento**.

---

## 📋 Passo 1: Verificar Modo do App

1. Vá em **"Configurações"** → **"Básico"**
2. Procure por **"Modo do aplicativo"** ou **"App Mode"**
3. Deve estar em **"Desenvolvimento"** ou **"Development"**

Se estiver em **"Produção"** ou **"Live"**, mude para **"Desenvolvimento"**.

---

## 📋 Passo 2: Remover a URL da Lista (Se Estiver Lá)

Como a dica diz que localhost não precisa ser adicionado manualmente em modo de desenvolvimento:

1. **Remova** `http://localhost:3000/api/whatsapp/facebook-callback` da lista de URIs válidos
2. Deixe o campo vazio
3. **Salve**

---

## 📋 Passo 3: Testar no Validador

1. No validador, cole a URL:
   ```
   http://localhost:3000/api/whatsapp/facebook-callback
   ```
2. Clique em **"Verificar URI"**
3. Deve funcionar agora (se o app estiver em modo de desenvolvimento)

---

## 🔄 Alternativa: Usar ngrok ou Similar (Se Não Funcionar)

Se mesmo em modo de desenvolvimento não funcionar, podemos usar um túnel HTTPS:

1. Instalar ngrok: https://ngrok.com/
2. Rodar: `ngrok http 3000`
3. Usar a URL HTTPS fornecida pelo ngrok

Mas primeiro, tente verificar o modo de desenvolvimento!

---

## ✅ Checklist

- [ ] App está em modo "Desenvolvimento"?
- [ ] Removida a URL da lista de URIs válidos?
- [ ] Testou no validador?

Me avise o resultado! 🚀

