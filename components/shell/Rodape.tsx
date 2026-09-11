import { fBR } from '@/lib/format';

export function Rodape({ asOf, ultimoDia }: { asOf: string; ultimoDia: string }) {
  return (
    <footer className="rodape">
      <p>
        Dados de tráfego: <b>Source: OpenRouter (openrouter.ai/rankings), as of {ultimoDia}</b>, sob{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" rel="license noopener">CC BY 4.0</a>. Índices de qualidade: Artificial Analysis, via
        OpenRouter. Model Season não é afiliado ao OpenRouter nem a nenhum laboratório.
      </p>
      <p>
        Pipeline atualizado em {fBR(asOf)}. Todo número desta página sai de arquivo versionado no{' '}
        <a href="https://github.com/falercia/modelseason">repositório público</a>, e nenhum é escrito à mão. Share é fatia do tráfego de um
        roteador, não participação de mercado, de receita ou de usuários.
      </p>
    </footer>
  );
}
