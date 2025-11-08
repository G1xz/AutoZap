# 🔑 Variáveis de Ambiente para Facebook OAuth

Adicione estas variáveis no seu arquivo `.env` na raiz do projeto.

---

## 📝 Variáveis Necessárias

```env
# Facebook OAuth (Conectar WhatsApp via Facebook)
FACEBOOK_CLIENT_ID=2058451241567788
FACEBOOK_CLIENT_SECRET=seu_app_secret_aqui

# NextAuth (já deve ter)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=sua_chave_secreta_aqui

# Database (já deve ter)
DATABASE_URL=sua_url_do_banco_aqui
```

---

## 🔑 Onde Obter os Valores

### FACEBOOK_CLIENT_ID
- ✅ Você já tem: `2058451241567788` (App ID do seu app AutoZap)
- 📍 Onde encontrar: Meta for Developers → Seu App → Configurações → Básico → "ID do aplicativo"

### FACEBOOK_CLIENT_SECRET
- ⚠️ Você precisa copiar: "Chave secreta do aplicativo"
- 📍 Onde encontrar: Meta for Developers → Seu App → Configurações → Básico → "Chave secreta do aplicativo"
- 🔒 Clique em "Mostrar" para ver (pode pedir senha do Facebook)
- ⚠️ **Importante:** Você só vê uma vez! Copie e guarde com segurança

### NEXTAUTH_URL
- ✅ Para desenvolvimento: `http://localhost:3000`
- ✅ Para produção: `https://seu-dominio.com`

### NEXTAUTH_SECRET
- ✅ Se já tiver, mantenha
- ✅ Se não tiver, gere uma:
  ```bash
  openssl rand -base64 32
  ```

---

## 📋 Exemplo Completo do .env

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# NextAuth
NEXTAUTH_SECRET=sua_chave_secreta_gerada
NEXTAUTH_URL=http://localhost:3000

# Facebook OAuth (Conectar WhatsApp)
FACEBOOK_CLIENT_ID=2058451241567788
FACEBOOK_CLIENT_SECRET=cole_o_app_secret_aqui
```

---

## ⚠️ Importante

1. **Não commite o `.env` no Git!** (já deve estar no `.gitignore`)
2. **App Secret é sensível** - guarde com segurança
3. **Reinicie o servidor** após adicionar as variáveis:
   ```bash
   # Pare o servidor (Ctrl+C)
   npm run dev
   ```

---

## ✅ Checklist

- [ ] FACEBOOK_CLIENT_ID adicionado (2058451241567788)
- [ ] FACEBOOK_CLIENT_SECRET adicionado (copiado do Meta for Developers)
- [ ] NEXTAUTH_URL configurado
- [ ] NEXTAUTH_SECRET configurado
- [ ] Servidor reiniciado

---

Pronto! Adicione essas variáveis e reinicie o servidor! 🚀

