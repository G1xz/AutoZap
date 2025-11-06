# 📋 Como Configurar o ngrok

## Passo 1: Criar Conta no ngrok (Gratuita)

1. Acesse: **https://dashboard.ngrok.com/signup**
2. Crie uma conta (pode usar email e senha)
3. Confirme seu email

## Passo 2: Obter Token de Autenticação

1. Depois de criar a conta, acesse: **https://dashboard.ngrok.com/get-started/your-authtoken**
2. Você verá um token (exemplo: `2abc123def456ghi789jkl012mno345pqr678`)
3. **Copie esse token**

## Passo 3: Autenticar o ngrok

No terminal, execute:

```bash
ngrok config add-authtoken SEU_TOKEN_AQUI
```

Substitua `SEU_TOKEN_AQUI` pelo token que você copiou.

## Passo 4: Executar o ngrok

Depois de autenticar, execute:

```bash
ngrok http 3000
```

Agora deve funcionar e você verá a URL do tunnel!



