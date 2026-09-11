'use client';
import { gaAtivo } from './Analytics';
import { useIdioma } from './Idioma';

export function Rodape({ asOf, ultimoDia }: { asOf: string; ultimoDia: string }) {
  const { t, f } = useIdioma();
  const cc = <a href="https://creativecommons.org/licenses/by/4.0/" rel="license noopener">CC BY 4.0</a>;
  const repo = (txt: string) => <a href="https://github.com/falercia/modelseason">{txt}</a>;
  return (
    <footer className="rodape">
      <p>
        {t({ pt: 'Dados de tráfego', en: 'Traffic data' })}: <b>Source: OpenRouter (openrouter.ai/rankings), as of {ultimoDia}</b>
        {t({
          pt: <>, sob {cc}. Índices de qualidade: Artificial Analysis, via OpenRouter. Model Season não é afiliado ao OpenRouter nem a nenhum laboratório.</>,
          en: <>, under {cc}. Quality indexes: Artificial Analysis, via OpenRouter. Model Season is not affiliated with OpenRouter or with any lab.</>,
        })}
      </p>
      <p>
        {t({
          pt: <>Pipeline atualizado em {f.fBR(asOf)}. Todo número desta página sai de arquivo versionado no {repo('repositório público')}, e nenhum é escrito à mão. Share é fatia do tráfego de um
            roteador, não participação de mercado, de receita ou de usuários.</>,
          en: <>Pipeline updated {f.fBR(asOf)}. Every number on this page comes from a versioned file in the {repo('public repository')}, and none is typed by hand. Share is a slice of one
            router&apos;s traffic, not market share, revenue share or user share.</>,
        })}
      </p>
      {gaAtivo && (
        <p>
          {t({
            pt: 'Esta página usa o Google Analytics para contar visitas e entender quais seções são lidas. Nenhum dado é usado para publicidade.',
            en: 'This page uses Google Analytics to count visits and see which sections are read. No data is used for advertising.',
          })}
        </p>
      )}
    </footer>
  );
}
