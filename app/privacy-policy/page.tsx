export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white shadow rounded-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Política de Privacidade
        </h1>
        
        <div className="prose prose-lg max-w-none">
          <p className="text-gray-600 mb-6">
            <strong>Última atualização:</strong> {new Date().toLocaleDateString('pt-BR')}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              1. Informações que Coletamos
            </h2>
            <p className="text-gray-700 mb-4">
              Coletamos as seguintes informações quando você usa nosso serviço:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li><strong>Dados de autenticação:</strong> Quando você autoriza o acesso via Facebook OAuth, coletamos informações básicas do seu perfil (nome, ID do Facebook).</li>
              <li><strong>Dados do WhatsApp Business:</strong> Coletamos Phone Number ID, Access Token e Business Account ID necessários para conectar sua conta WhatsApp Business.</li>
              <li><strong>Mensagens:</strong> Armazenamos mensagens enviadas e recebidas através do WhatsApp para fornecer o serviço de automação.</li>
              <li><strong>Dados de contato:</strong> Números de telefone e nomes de contatos que interagem com seu WhatsApp Business.</li>
              <li><strong>Dados de configuração:</strong> Workflows, regras de automação e configurações que você cria no sistema.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              2. Como Usamos suas Informações
            </h2>
            <p className="text-gray-700 mb-4">
              Utilizamos suas informações para:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>Fornecer e melhorar nossos serviços de automação de WhatsApp</li>
              <li>Processar e enviar mensagens automáticas conforme suas configurações</li>
              <li>Gerenciar sua conta e fornecer suporte ao cliente</li>
              <li>Cumprir obrigações legais e proteger nossos direitos</li>
              <li>Enviar notificações sobre o serviço (quando necessário)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              3. Compartilhamento de Informações
            </h2>
            <p className="text-gray-700 mb-4">
              Não vendemos, alugamos ou compartilhamos suas informações pessoais com terceiros, exceto:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li><strong>Meta/Facebook:</strong> Compartilhamos dados necessários para operar o WhatsApp Business API, conforme autorizado por você via OAuth.</li>
              <li><strong>Prestadores de serviço:</strong> Podemos compartilhar dados com provedores de serviços que nos ajudam a operar (hospedagem, banco de dados), sob acordos de confidencialidade.</li>
              <li><strong>Obrigações legais:</strong> Quando exigido por lei ou para proteger nossos direitos legais.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              4. Segurança dos Dados
            </h2>
            <p className="text-gray-700 mb-4">
              Implementamos medidas de segurança técnicas e organizacionais para proteger suas informações:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>Criptografia de dados em trânsito (HTTPS)</li>
              <li>Criptografia de dados sensíveis armazenados (tokens, credenciais)</li>
              <li>Controles de acesso e autenticação</li>
              <li>Monitoramento regular de segurança</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              5. Retenção de Dados
            </h2>
            <p className="text-gray-700 mb-4">
              Mantemos suas informações enquanto necessário para fornecer o serviço ou conforme exigido por lei. Você pode configurar a retenção de mensagens nas configurações do sistema (padrão: 90 dias).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              6. Seus Direitos
            </h2>
            <p className="text-gray-700 mb-4">
              Você tem o direito de:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li><strong>Acessar:</strong> Solicitar uma cópia dos dados que temos sobre você</li>
              <li><strong>Corrigir:</strong> Solicitar correção de dados incorretos</li>
              <li><strong>Excluir:</strong> Solicitar exclusão de seus dados (sujeito a obrigações legais)</li>
              <li><strong>Portabilidade:</strong> Solicitar exportação de seus dados em formato legível</li>
              <li><strong>Revogar consentimento:</strong> Desconectar sua conta a qualquer momento</li>
            </ul>
            <p className="text-gray-700 mb-4">
              Para exercer esses direitos, entre em contato conosco através do e-mail: <strong>genshing1xz@gmail.com</strong>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              7. Cookies e Tecnologias Similares
            </h2>
            <p className="text-gray-700 mb-4">
              Utilizamos cookies e tecnologias similares para melhorar sua experiência, autenticação e funcionalidades do serviço. Você pode gerenciar preferências de cookies nas configurações do navegador.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              8. Alterações nesta Política
            </h2>
            <p className="text-gray-700 mb-4">
              Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos você sobre mudanças significativas por e-mail ou através do serviço. A data da última atualização está indicada no topo desta página.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              9. Contato
            </h2>
            <p className="text-gray-700 mb-4">
              Se você tiver dúvidas sobre esta Política de Privacidade ou sobre como tratamos seus dados, entre em contato conosco:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700">
                <strong>E-mail:</strong> genshing1xz@gmail.com
              </p>
              <p className="text-gray-700 mt-2">
                <strong>Site:</strong> <a href="https://autoflow.dev.br" className="text-blue-600 hover:underline">https://autoflow.dev.br</a>
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              10. Lei Aplicável
            </h2>
            <p className="text-gray-700 mb-4">
              Esta Política de Privacidade é regida pelas leis do Brasil. Qualquer disputa será resolvida nos tribunais competentes do Brasil.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              11. Integração com Meta/Facebook
            </h2>
            <p className="text-gray-700 mb-4">
              Nosso serviço utiliza a API oficial do WhatsApp Business da Meta. Quando você autoriza o acesso via Facebook OAuth:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>Você autoriza nosso app a acessar sua conta Meta Business e WhatsApp Business</li>
              <li>Coletamos apenas as informações necessárias para operar o serviço (Phone Number ID, Access Token, Business Account ID)</li>
              <li>Não compartilhamos suas informações com terceiros além do necessário para operar o serviço</li>
              <li>Você pode revogar o acesso a qualquer momento desconectando sua conta</li>
            </ul>
            <p className="text-gray-700 mb-4">
              Para mais informações sobre como a Meta trata seus dados, consulte a <a href="https://www.facebook.com/privacy/policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Política de Privacidade da Meta</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

