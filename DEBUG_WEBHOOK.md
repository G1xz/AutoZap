# 🔍 Debug do Webhook

## Problemas Comuns e Soluções

### 1. Verificar se o localtunnel está rodando

Execute em um terminal separado:
```bash
npx localtunnel --port 3000
```

Você deve ver:
```
your url is: https://alguma-coisa.loca.lt
```

### 2. Verificar se o webhook está ativo no Meta

1. Acesse: https://developers.facebook.com
2. Vá em seu app → WhatsApp → Configuração → Webhooks
3. Verifique se o webhook está marcado como **"✓ Verificado"**
4. Verifique se os eventos estão marcados:
   - ✅ messages
   - ✅ message_status (opcional)

### 3. Testar o webhook manualmente

Acesse no navegador (ou use curl):
```
https://tidy-experts-switch.loca.lt/api/whatsapp/webhook?instanceId=cmhk0om720001t9aov48x4n4f&hub.mode=subscribe&hub.verify_token=verify_cmhk0om720001t9aov48x4n4f_1762227451053&hub.challenge=teste123
```

Se funcionar, você deve ver `teste123` como resposta.

### 4. Verificar se o número está conectado

- O número que você está usando para enviar mensagens precisa estar conectado ao Phone Number ID configurado
- Verifique no Meta for Developers se o número está ativo

### 5. Verificar logs do localtunnel

O localtunnel deve mostrar requisições quando chegam. Se não aparecer nada, o problema pode ser:
- O localtunnel não está rodando
- O Meta não está conseguindo acessar a URL



