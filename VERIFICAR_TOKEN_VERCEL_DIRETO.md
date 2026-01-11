# 🔍 Verificar Token no Vercel - Diretamente

O problema é que os tokens têm tamanhos diferentes. Vamos verificar o token no Vercel diretamente.

---

## ✅ Passo 1: Verificar Token no Vercel

1. **Vercel** → Settings → Environment Variables
2. **Clique em `WEBHOOK_VERIFY_TOKEN`** (para editar)
3. **Olhe o campo "Value"**
4. **Copie o valor EXATO** (Ctrl+C)
5. **Cole em um editor de texto** (Notepad, etc)
6. **Verifique:**
   - Quantos caracteres tem?
   - Tem espaços no início ou fim?
   - Tem quebras de linha?
   - Está exatamente: `r5S1uAJvQ9hhHRX8C7Pen4I2LxMgzmWc0`?

---

## ✅ Passo 2: Comparar Tamanhos

O token que você está usando na URL tem **35 caracteres**:
```
r5S1uAJvQ9hhHRX8C7Pen4I2LxMgzmWc0
```

**Conte quantos caracteres tem o token no Vercel:**
- Se tiver **mais de 35** → Tem espaços ou caracteres extras
- Se tiver **menos de 35** → Está faltando caracteres
- Se tiver **exatamente 35** → Mas ainda não funciona, pode ser encoding

---

## ✅ Passo 3: Corrigir se Necessário

### Se o token no Vercel tiver espaços:

1. **Edite a variável no Vercel**
2. **Apague TODOS os espaços** (início, fim, meio)
3. **Cole novamente:** `r5S1uAJvQ9hhHRX8C7Pen4I2LxMgzmWc0`
4. **Salve**
5. **Faça redeploy**

### Se o token no Vercel estiver diferente:

1. **Edite a variável no Vercel**
2. **Cole o token correto:** `r5S1uAJvQ9hhHRX8C7Pen4I2LxMgzmWc0`
3. **Salve**
4. **Faça redeploy**

---

## 🧪 Teste Depois

Após corrigir:

1. **Teste a URL:**
   ```
   https://autoflow.dev.br/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=r5S1uAJvQ9hhHRX8C7Pen4I2LxMgzmWc0&hub.challenge=teste123
   ```

2. **Deve retornar:** `teste123` (não erro)

---

**Verifique o token no Vercel e me diga quantos caracteres tem! 🔍**

