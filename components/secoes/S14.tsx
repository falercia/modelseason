'use client';
/**
 * Seção 14: sinais da temporada. Achados por regra e extrapolação condicional
 * vêm prontos do motor (R.sinais); os dois respondem à janela, ao agrupamento
 * e ao filtro. O cartão de finalidade depende do arquivo diário de tarefas e
 * mostra, sem número inventado, quanto falta para a primeira comparação.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Mercado } from '@/lib/tipos';
import type { Achado } from '@/lib/engine';
import { useHistorico } from '@/components/shell/Historico';
import { Cartao, Secao } from '@/components/shell/Cartao';
import { fD, fmtP, urlModelo } from '@/lib/format';
import { nomeModelo } from './S12';
import s from './s14.module.css';

/** O texto do achado cita o slug; ele vira link para a página do modelo, com o nome legível. */
function TextoAchado({ a, nome }: { a: Achado; nome: (slug: string) => string }) {
  if (!a.slug || !a.p.includes(a.slug)) return <>{a.p}</>;
  const partes = a.p.split(a.slug);
  const out: ReactNode[] = [];
  partes.forEach((p, i) => {
    if (i > 0) out.push(<Link key={'l' + i} href={urlModelo(a.slug!)} title={a.slug}>{nome(a.slug!)}</Link>);
    out.push(<span key={'t' + i}>{p}</span>);
  });
  return <>{out}</>;
}

function Finalidade({ M }: { M: Mercado }) {
  const T = M.tarefas;
  if (!T) {
    return <Cartao id="sinais-finalidade" novo><p className="vazio">A fonte não publicou foto de tarefas nesta versão dos dados, então não há base para comparar.</p></Cartao>;
  }
  // Cada foto cobre janela_dias dias. Duas fotos só medem períodos sem sobreposição
  // quando estão separadas pela própria janela: a de hoje e a de janela_dias atrás.
  const necessarias = T.janela_dias + 1;
  const fotos = T.fotos_arquivadas;
  const faltam = Math.max(0, necessarias - fotos);
  const quando = new Date(T.as_of + 'T00:00:00');
  quando.setDate(quando.getDate() + faltam);
  const lider = [...T.classificacoes].sort((a, b) => b.token_share - a.token_share)[0];
  return (
    <Cartao id="sinais-finalidade" novo subtitulo={<>A tarefa que mais cresceu entre a foto de hoje e a de {T.janela_dias} dias antes, e o modelo que mais avançou nela. Não responde à janela nem ao filtro.</>}>
      <div className={'vazio ' + s.vz}>
        <span className={s.kick}>Aguardando o arquivo</span>
        <div className={s.fotos} role="img" aria-label={`${Math.min(fotos, necessarias)} de ${necessarias} fotos necessárias arquivadas`}>
          {Array.from({ length: necessarias }, (_, i) => <i key={i} className={i < fotos ? s.ok : undefined} />)}
          <span>{fotos} de {necessarias} fotos</span>
        </div>
        {faltam > 0 ? (
          <p>O arquivo tem <b>{fotos} {fotos === 1 ? 'foto diária' : 'fotos diárias'}</b> de tarefas, a mais recente de {fD(T.as_of)}. Cada foto cobre {T.janela_dias} dias, então a primeira comparação sem sobreposição precisa de <b>{necessarias} fotos</b>: faltam <b>{faltam}</b>. Se nenhum dia falhar, ela sai com a foto de {fD(quando)}.</p>
        ) : (
          <p>O arquivo já tem {fotos} fotos diárias, o bastante para comparar janelas de {T.janela_dias} dias sem sobreposição. A comparação ainda não foi publicada pelo pipeline, e este cartão não calcula nada por conta própria.</p>
        )}
        <p>Quando houver, aparece aqui a tarefa que mais ganhou share de tokens entre as duas fotos, em pontos percentuais, o modelo que mais avançou dentro dela e a tarefa que mais perdeu, para contraste.</p>
        {lider && <p>A foto de hoje já está guardada: {T.classificacoes.length} tarefas classificadas, lideradas por <b>{lider.nome}</b>, com {fmtP(lider.token_share)} dos tokens classificados.</p>}
        <p style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>A fonte só publica a semana corrente e não guarda passado. Cada dia sem arquivar é um dia que não volta.</p>
      </div>
    </Cartao>
  );
}

export default function S14({ M }: { M: Mercado }) {
  const { D, R } = useHistorico();
  const S = R.sinais;
  const nomes = new Map(D.matriz.modelos.map(m => [m.s, m.n]));
  const nome = (slug: string) => nomeModelo(slug, nomes.get(slug));
  const per = (n: number) => (n === 1 ? S.per1 : S.perN);
  const n = S.achados.length;

  return (
    <Secao id="s14" n="14" titulo="Sinais da temporada"
      sub={<>O que está fora do padrão nesta janela, detectado automaticamente, e para onde os números vão <b>se a taxa atual se mantiver</b>. A segunda parte não é previsão, e a página inteira existe para mostrar que essas taxas mudam.</>}>
      <Cartao id="sinais" subtitulo={n ? `${n} ${n === 1 ? 'padrão quebrado' : 'padrões quebrados'} nesta janela, detectados por regra, não por curadoria.` : 'Nada fora do padrão nesta janela.'}>
        {n ? (
          <div className={s.sin} style={{ ['--cols' as string]: n === 5 ? 3 : Math.min(n, 4) }}>
            {S.achados.map(a => (
              <div className={s.s} key={a.t}>
                <span className={s.rot}>{a.t}</span>
                <span className={s.val}>{a.v}</span>
                <p className={s.txt}><TextoAchado a={a} nome={nome} /></p>
              </div>
            ))}
          </div>
        ) : (
          <p className="vazio">Nenhuma das regras disparou nesta janela. Isso também é informação: o mercado está se movendo dentro do padrão dele. Janelas mais longas dão mais chance a regras que dependem de tendência.</p>
        )}
      </Cartao>

      <div className={s.cols}>
        <Cartao id="projecao" subtitulo={`Reta ajustada às últimas ${S.base} ${per(S.base)}, estendida por mais ${S.horiz} ${per(S.horiz)}.`}>
          {S.projs.length ? (
            <>
              <div className="tabwrap">
                <table className={'t ' + s.prj}>
                  <thead><tr><th>Indicador</th><th>Agora</th><th>Ritmo por {S.per1}</th><th>Em {S.horiz} {per(S.horiz)}</th></tr></thead>
                  <tbody>{S.projs.map(p => (
                    <tr key={p.rot}>
                      <td>{p.rot}</td>
                      <td data-rot="agora">{p.atual}</td>
                      <td data-rot={`ritmo por ${S.per1}`}><span className={s.seta} aria-hidden="true">{p.dir === 'sobe' ? '↗' : '↘'}</span>{p.dir === 'sobe' ? '+' : '−'}{p.taxa}<span className="sr"> {p.dir === 'sobe' ? 'subindo' : 'caindo'}</span></td>
                      <td data-rot={`em ${S.horiz} ${per(S.horiz)}`}>{p.rompe
                        ? <span className={s.rompe}>bate em {p.rompe.lim} em {p.rompe.n} {per(p.rompe.n)}</span>
                        : <span className={s.alvo}>{p.alvo}</span>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {S.projs.some(p => p.rompe) && (
                <p className="nota">Em <span className={s.rompe}>vermelho</span>, as séries cuja reta bate no piso ou no teto antes de uma vez e meia o horizonte. Ali o valor de chegada não é publicado: não é previsão de que vão zerar ou saturar, é a prova de que a taxa atual não se mantém por tanto tempo.</p>
              )}
            </>
          ) : <p className="vazio">Nenhuma série com movimento consistente o bastante nesta janela para projetar.</p>}
          <p className="nao"><b>Isto não é previsão.</b> É a taxa observada nas últimas {S.base} {per(S.base)} estendida em linha reta. A tese desta página é justamente que essas taxas mudam, então o número serve para dimensionar ordem de grandeza e provocar a pergunta certa, não para planejar.</p>
        </Cartao>
        <Finalidade M={M} />
      </div>
    </Secao>
  );
}

