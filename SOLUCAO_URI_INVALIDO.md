# 🔧 Solução: URI de Redirecionamento Inválido

O problema é que você tem **"Forçar HTTPS"** ativado, mas `localhost` usa HTTP.

---

## ✅ Solução 1: Desativar "Forçar HTTPS" (Desenvolvimento)

1. Na tela de configurações do Facebook Login
2. Procure por **"Forçar HTTPS"** (Force HTTPS)
3. **Desative** (mude para "Não")
4. **Salve as alterações**

Agora tente adicionar a URL novamente:
```
http://localhost:3000/api/whatsapp/facebook-callback
```

---

## ✅ Solução 2: Adicionar Domínio nas Configurações Básicas

Também precisa adicionar o domínio:

1. Vá em **"Configurações"** → **"Básico"**
2. Procure por **"Domínios do aplicativo"** ou **"App Domains"**
3. Adicione: `localhost`
4. **Salve**

---

## ✅ Solução 3: Verificar URL Exata

A URL deve ser **exatamente** assim (sem barra no final):
```
http://localhost:3000/api/whatsapp/facebook-callback
```

**NÃO pode ser:**
- ❌ `http://localhost:3000/api/whatsapp/facebook-callback/` (com barra)
- ❌ `https://localhost:3000/api/whatsapp/facebook-callback` (com https)
- ❌ `http://127.0.0.1:3000/api/whatsapp/facebook-callback` (com IP)

---

## 📋 Passo a Passo Completo

1. ✅ **Desative "Forçar HTTPS"** (mude para "Não")
2. ✅ **Adicione `localhost` em "Domínios do aplicativo"** (Configurações → Básico)
3. ✅ **Adicione a URL** no campo "URIs de redirecionamento OAuth válidos":
   ```
   http://localhost:3000/api/whatsapp/facebook-callback
   ```
4. ✅ **Salve todas as alterações**
5. ✅ **Teste novamente** no validador

---

## 🚀 Para Produção (Depois)

Quando for para produção, você vai:
- ✅ Ativar "Forçar HTTPS" novamente
- ✅ Adicionar seu domínio real (ex: `autozap.com.br`)
- ✅ Adicionar a URL de produção:
  ```
  https://seu-dominio.com/api/whatsapp/facebook-callback
  ```

---

Tente essas soluções e me avise! 🎯

