# ⚠️ Número de Teste vs Número Real - Limitações

## 🔴 Problema: Números de Teste Têm Limitações

Se você conectou com um **número de teste** do Meta, ele tem limitações importantes:

### ❌ Limitações de Números de Teste:

1. **Só pode enviar para números adicionados como testadores**
   - Você precisa adicionar cada número de destino na lista de testadores
   - Não pode enviar para qualquer número

2. **Não funciona em produção**
   - Números de teste são apenas para desenvolvimento
   - Não podem ser usados com clientes reais

3. **Limitações de uso**
   - Podem ter restrições de quantidade de mensagens
   - Podem expirar após um tempo

---

## ✅ Solução: Usar Número Real

Para funcionar em produção, você precisa de um **número real** do WhatsApp Business.

### Como Obter um Número Real:

1. **Acesse:** https://business.facebook.com/
2. Vá em **"Gerenciador do WhatsApp"** → **"Telefones"**
3. Clique em **"Adicionar número de telefone"**
4. Siga o processo de verificação
5. **Importante:** Use um número que você tenha acesso (pode receber SMS/código)

---

## 🧪 Como Adicionar Números como Testadores (Se Quiser Continuar Testando)

Se você quiser continuar usando o número de teste temporariamente:

### Passo 1: Adicionar Números como Testadores

1. Acesse: https://developers.facebook.com/
2. Vá no seu app (AutoZap)
3. Vá em **"WhatsApp"** → **"Configuração Inicial"** (ou **"Getting Started"**)
4. Procure por **"Números de telefone de teste"** ou **"Test Phone Numbers"**
5. Clique em **"Gerenciar números de teste"** ou **"Manage test numbers"**
6. Adicione os números que você quer testar (formato: 5511999999999)
7. Salve

### Passo 2: Testar Envio

Agora você pode enviar mensagens para os números adicionados como testadores.

**⚠️ Importante:** Só funcionará para os números que você adicionou!

---

## 🎯 Recomendação: Migrar para Número Real

Para produção, você **precisa** de um número real:

1. ✅ **Pode enviar para qualquer número** (sem precisar adicionar como testador)
2. ✅ **Funciona em produção** com clientes reais
3. ✅ **Sem limitações** de uso
4. ✅ **Aprovado pelo Meta** (seu app já está aprovado!)

---

## 🔄 Como Migrar de Teste para Real

### Opção 1: Conectar um Número Real Existente

1. No sistema, **desconecte** a instância atual (se quiser)
2. Crie uma nova instância
3. Conecte via Facebook OAuth usando uma conta que tenha um **número real** verificado
4. Pronto!

### Opção 2: Verificar Número de Teste como Real

1. Acesse: https://business.facebook.com/
2. Vá em **"Gerenciador do WhatsApp"** → **"Telefones"**
3. Encontre seu número de teste
4. Siga o processo para **verificar como número real**
5. Isso pode exigir verificação de identidade e/ou pagamento

---

## ❓ O Que Não Está Funcionando?

Me diga especificamente o que não está funcionando:

- ❌ **Não consegue enviar mensagem?** → Provavelmente porque o número de destino não está na lista de testadores
- ❌ **Mensagem não chega?** → Verifique se o número de destino está na lista de testadores
- ❌ **Erro ao enviar?** → Verifique os logs para ver o erro específico

---

## 📋 Checklist para Resolver

- [ ] Identificar se é número de teste ou real
- [ ] Se for teste: adicionar números de destino como testadores
- [ ] Se for produção: migrar para número real
- [ ] Testar envio após correção
- [ ] Verificar se mensagem chega

---

## 💡 Dica

**Para produção, sempre use números reais!** Números de teste são apenas para desenvolvimento e testes iniciais.

Se você já tem o app aprovado, pode usar números reais sem problemas! 🚀

