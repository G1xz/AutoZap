# Configurar Cloudinary

## O que foi implementado

✅ **Upload de arquivos para Cloudinary**
- Todos os uploads agora vão direto para o Cloudinary
- Não salva mais arquivos localmente na pasta `uploads/`
- URLs HTTPS públicas e otimizadas

✅ **Envio de imagens/vídeos**
- Funciona com URLs do Cloudinary diretamente
- Compatível com URLs antigas (relativas) para não quebrar código existente

✅ **Processamento de mídia recebida**
- Quando alguém envia imagem/vídeo/documento/áudio via WhatsApp:
  - Sistema baixa automaticamente do WhatsApp
  - Salva no Cloudinary
  - Armazena URL no banco de dados
  - Disponível para visualização no chat

## Como configurar

### 1. Criar conta no Cloudinary (GRATUITO)

1. Acesse: https://cloudinary.com/users/register/free
2. Crie uma conta gratuita
3. Você receberá:
   - **Cloud Name** (ex: `dabc123`)
   - **API Key** (ex: `123456789012345`)
   - **API Secret** (ex: `abcdefghijklmnopqrstuvwxyz`)

### 2. Adicionar variáveis de ambiente

Adicione no seu `.env`:

```env
CLOUDINARY_CLOUD_NAME=seu_cloud_name
CLOUDINARY_API_KEY=sua_api_key
CLOUDINARY_API_SECRET=seu_api_secret
```

### 3. Adicionar no Vercel

1. Acesse: https://vercel.com/dashboard
2. Vá em seu projeto → Settings → Environment Variables
3. Adicione as 3 variáveis:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
4. Faça redeploy

## Limites do plano gratuito

- ✅ **25 GB** de armazenamento
- ✅ **25 GB** de largura de banda/mês
- ✅ Otimização automática de imagens
- ✅ CDN global (carregamento rápido)
- ✅ Suporte a imagens, vídeos e documentos

## Estrutura de pastas no Cloudinary

Os arquivos são organizados assim:

```
autozap/
  ├── {userId}/          # Uploads do usuário
  │   └── received/      # Mídia recebida do WhatsApp
  └── received/          # Mídia recebida (fallback)
```

## Como funciona agora

### Upload de arquivo (você envia)
1. Usuário faz upload via interface
2. Arquivo vai direto para Cloudinary
3. Retorna URL HTTPS (ex: `https://res.cloudinary.com/...`)
4. URL é salva e usada para enviar via WhatsApp

### Mídia recebida (cliente envia)
1. Cliente envia imagem/vídeo via WhatsApp
2. Webhook recebe notificação
3. Sistema baixa mídia do WhatsApp
4. Faz upload para Cloudinary
5. Salva URL no banco (`Message.mediaUrl`)
6. Disponível para visualização no chat

## Próximos passos

1. ✅ Criar conta no Cloudinary
2. ✅ Adicionar variáveis no `.env`
3. ✅ Adicionar variáveis no Vercel
4. ✅ Fazer redeploy
5. ✅ Testar upload de arquivo
6. ✅ Testar recebimento de mídia

## Notas importantes

- ⚠️ **Não precisa mais da pasta `uploads/`** - pode deletar se quiser
- ⚠️ **URLs antigas** (relativas como `/api/files/...`) ainda funcionam por compatibilidade
- ⚠️ **Mídia recebida** é salva automaticamente - não precisa fazer nada
- ⚠️ **Limite de 10MB** por arquivo continua valendo

