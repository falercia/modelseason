'use client';
/**
 * Seção 05: que carga o tráfego exige. Nova na v2.
 *
 * Três áreas empilhadas 100% com o share do volume por atributo do modelo que
 * atendeu o tráfego: faixa de janela de contexto, modalidade de entrada e
 * raciocínio declarado no catálogo. As séries saem prontas do motor
 * (R.faixa_ctx_share, R.multimodal_share, R.raciocinio_share), já recortadas
 * pela janela, pelo agrupamento e pelos filtros.
 *
 * "Não identificado" fica sempre no topo da pilha, em cinza, e a leitura diz o
 * tamanho dela: é a medida de cobertura do metadado, e esconder a faixa
 * inflaria as outras.
 */
import type { ReactNode } from 'react';
import type { Mercado } from '@/lib/tipos';
import type { Recorte, Series } from '@/lib/engine';
import { Cartao, Secao } from '@/components/shell/Cartao';
import { useHistorico } from '@/components/shell/Historico';
import { useIdioma } from '@/components/shell/Idioma';
import { Legenda, TabelaSerie, Temporal, type ItemSerie } from '@/components/graficos/base';
import { usePeriodo } from './s02-comum';

const NI = 'Não identificado';

/**
 * Ordem de baixo para cima na pilha, e cor de cada categoria. As quatro cores
 * categóricas não formam escala sequencial; a progressão é dada pela ordem e
 * pelas pontas fixas: verde é sempre a ponta de menor exigência e laranja a de
 * maior, nos três cartões. Ordem das faixas de contexto validada para
 * daltonismo nos dois temas (pares adjacentes com ΔE ≥ 8).
 */
interface Dim { chave: keyof Pick<Recorte, 'faixa_ctx_share' | 'multimodal_share' | 'raciocinio_share'>; ordem: [string, string][]; foco: string }
const CONTEXTO: Dim = {
  chave: 'faixa_ctx_share', foco: 'Acima de 400k',
  ordem: [['Até 32k', '--s3'], ['33k a 128k', '--s4'], ['129k a 400k', '--s1'], ['Acima de 400k', '--s2'], [NI, '--s0']],
};
const MODALIDADE: Dim = {
  chave: 'multimodal_share', foco: 'Multimodal',
  ordem: [['Só texto', '--s3'], ['Multimodal', '--s2'], [NI, '--s0']],
};
const RACIOCINIO: Dim = {
  chave: 'raciocinio_share', foco: 'Com raciocínio',
  ordem: [['Sem raciocínio', '--s3'], ['Com raciocínio', '--s2'], [NI, '--s0']],
};

/**
 * Séries na ordem da pilha; categoria que o recorte não tem fica fora. Categoria desconhecida vai para baixo do cinza.
 * A chave continua sendo o valor do dado; só o rótulo passa pelo idioma.
 */
function montar(S: Series, d: Dim, rotulo: (k: string) => string): ItemSerie[] {
  const conhecidas = d.ordem.map(([k]) => k);
  const extras = Object.keys(S).filter(k => !conhecidas.includes(k));
  const ordem: [string, string][] = [...d.ordem.filter(([k]) => k !== NI), ...extras.map(k => [k, '--s0'] as [string, string]), ...d.ordem.filter(([k]) => k === NI)];
  return ordem.filter(([k]) => S[k] && S[k].some(v => v > 0)).map(([k, slot]) => ({ key: k, label: rotulo(k), values: S[k], slot }));
}

/** Share só entre o volume com metadado: tira a faixa cinza do denominador. */
const semNI = (S: Series, k: string, i: number) => {
  const ni = S[NI]?.[i] ?? 0, v = S[k]?.[i] ?? 0;
  return ni < 100 ? (100 * v) / (100 - ni) : null;
};

function Leitura({ S, d, R, extra }: { S: Series; d: Dim; R: Recorte; extra?: ReactNode }) {
  const { t, f, valor } = useIdioma();
  const { fmtP, fPer } = f;
  const u = R.N - 1, g = R.estado.gran;
  const cats = Object.keys(S).filter(k => k !== NI);
  const val = (k: string, i: number) => S[k]?.[i] ?? 0;
  const foco = cats.includes(d.foco) ? d.foco : [...cats].sort((a, b) => val(b, u) - val(a, u))[0];
  if (!foco) return <p className="leitura">{t({ pt: 'Nenhum volume no recorte atual.', en: 'No volume in the current filtered view.' })}</p>;
  // A categoria que mais se moveu, quando não é a mesma do foco.
  const mexeu = cats.filter(k => k !== foco).sort((a, b) => Math.abs(val(b, u) - val(b, 0)) - Math.abs(val(a, u) - val(a, 0)))[0];
  const dm = mexeu ? val(mexeu, u) - val(mexeu, 0) : 0;
  const ni0 = S[NI]?.[0] ?? 0, niU = S[NI]?.[u] ?? 0;
  const f0 = semNI(S, foco, 0), fU = semNI(S, foco, u);
  const verbo = (a: number, b: number) => (b > a
    ? t({ pt: 'subiu', en: 'rose' })
    : b < a ? t({ pt: 'caiu', en: 'fell' }) : t({ pt: 'ficou', en: 'went' }));
  const soIdent = Math.abs(ni0 - niU) >= 10 && f0 != null && fU != null;
  return (
    <div className="leitura">
      {R.cobertura.filtrando && <span className="pill" style={{ marginLeft: 0, marginRight: 6 }}>{t({ pt: 'recorte', en: 'filtered' })}</span>}
      {t({
        pt: <><b>{foco}</b> {verbo(val(foco, 0), val(foco, u))} de {fmtP(val(foco, 0))} para <b>{fmtP(val(foco, u))}</b> do volume entre {fPer(R.eixo[0], g)} e {fPer(R.eixo[u], g)}
          {soIdent ? <>; só no volume identificado, de {fmtP(f0)} para {fmtP(fU)}.</> : '.'}
          {mexeu && Math.abs(dm) >= 1 && <> {mexeu} {verbo(val(mexeu, 0), val(mexeu, u))} de {fmtP(val(mexeu, 0))} para {fmtP(val(mexeu, u))}.</>}
          {S[NI] ? <> Não identificado no fim da janela: <b>{fmtP(niU)}</b>.</> : <> Sem faixa cinza: o filtro ativo já exclui os modelos sem metadado.</>}</>,
        en: <><b>{valor(foco)}</b> {verbo(val(foco, 0), val(foco, u))} from {fmtP(val(foco, 0))} to <b>{fmtP(val(foco, u))}</b> of volume between {fPer(R.eixo[0], g)} and {fPer(R.eixo[u], g)}
          {soIdent ? <>; within identified volume alone, from {fmtP(f0)} to {fmtP(fU)}.</> : '.'}
          {mexeu && Math.abs(dm) >= 1 && <> {valor(mexeu)} {verbo(val(mexeu, 0), val(mexeu, u))} from {fmtP(val(mexeu, 0))} to {fmtP(val(mexeu, u))}.</>}
          {S[NI] ? <> Unknown at the end of the window: <b>{fmtP(niU)}</b>.</> : <> No gray band: the active filter already excludes models without metadata.</>}</>,
      })}
      {extra}
    </div>
  );
}

function CartaoCarga({ id, d, subtitulo, extra, altura = 210 }: { id: string; d: Dim; subtitulo: string; extra?: (S: Series, R: Recorte) => ReactNode; altura?: number }) {
  const { t, f, valor } = useIdioma();
  const { fmtP, fPer } = f;
  const { R } = useHistorico();
  const S = R[d.chave];
  const series = montar(S, d, valor);
  const g = R.estado.gran;
  const total = series.reduce((s, x) => s + (x.values.at(-1) ?? 0), 0);
  const atributo = id === 'carga-contexto'
    ? t({ pt: 'faixa de janela de contexto', en: 'context window tier' })
    : id === 'carga-modalidade' ? t({ pt: 'modalidade de entrada', en: 'input modality' }) : t({ pt: 'raciocínio declarado', en: 'declared reasoning' });
  return (
    <Cartao id={id} novo subtitulo={subtitulo}>
      {!series.length || total === 0 ? <p className="vazio">{t({ pt: 'Nenhum volume no recorte atual.', en: 'No volume in the current filtered view.' })}</p> : (
        <>
          <Legenda itens={series} />
          <Temporal eixo={R.eixo} gran={g} series={series} modo="empilhada" ymax={100} altura={altura}
            fmt={v => fmtP(v)} fmtEixo={v => v + '%'} m={{ t: 10, r: 8, b: 26, l: 38 }}
            rotuloAria={t({
              pt: `Área empilhada 100%: share do volume por ${atributo}, de ${fPer(R.eixo[0], g)} a ${fPer(R.eixo[R.N - 1], g)}.`,
              en: `100% stacked area: share of volume by ${atributo}, from ${fPer(R.eixo[0], g)} to ${fPer(R.eixo[R.N - 1], g)}.`,
            })} />
          <Leitura S={S} d={d} R={R} extra={extra?.(S, R)} />
          <TabelaSerie eixo={R.eixo} gran={g} series={[...series].reverse()} fmt={v => fmtP(v)} />
        </>
      )}
    </Cartao>
  );
}

export default function S05(_: { M: Mercado }) {
  const { R } = useHistorico();
  const { t, f } = useIdioma();
  const { fmtP, fPer } = f;
  const { per } = usePeriodo();
  const p = per(R), u = R.N - 1, g = R.estado.gran;
  const ni = R.faixa_ctx_share[NI];
  return (
    <Secao id="s05" n="05" titulo={t({ pt: 'Que carga o tráfego exige', en: 'What workload the traffic demands' })}
      sub={t({
        pt: <>Share do volume de cada {p.um} pelo atributo do modelo que atendeu o tráfego: janela de contexto máxima, modalidade de entrada e raciocínio declarado. Responde à janela, ao agrupamento e aos filtros.</>,
        en: <>Share of each {p.um}&apos;s volume by an attribute of the model that served the traffic: maximum context window, input modality and declared reasoning. It responds to the window, the grouping and the filters.</>,
      })}>
      {/* Contexto na largura toda: é o atributo que mais se move. Em três colunas o eixo do tempo fica com uma marca só. */}
      <CartaoCarga id="carga-contexto" d={CONTEXTO} altura={240}
        subtitulo={t({ pt: '% do volume por janela de contexto máxima do modelo', en: "% of volume by the model's maximum context window" })} />
      <div className="grid2" style={{ marginTop: 14 }}>
        <CartaoCarga id="carga-modalidade" d={MODALIDADE}
          subtitulo={t({ pt: '% do volume em modelos que aceitam só texto ou também imagem, áudio ou arquivo', en: '% of volume in models that accept text only or also image, audio or file' })} />
        <CartaoCarga id="carga-raciocinio" d={RACIOCINIO}
          subtitulo={t({ pt: '% do volume em modelos que declaram suporte a raciocínio no catálogo', en: '% of volume in models that declare reasoning support in the catalog' })}
          extra={(S, R) => {
            const u = R.N - 1, c = S['Com raciocínio']?.[u] ?? 0, s = S['Sem raciocínio']?.[u] ?? 0;
            if (c + s <= 0) return null;
            const pc = (100 * c) / (c + s);
            return pc >= 90
              ? t({
                pt: <> No volume identificado, {fmtP(pc)} já roda em modelo que declara raciocínio: o atributo saturou e não separa mais um tráfego do outro.</>,
                en: <> In identified volume, {fmtP(pc)} already runs on models that declare reasoning: the attribute has saturated and no longer separates one kind of traffic from another.</>,
              })
              : t({
                pt: <> No volume identificado, {fmtP(pc)} roda em modelo que declara raciocínio.</>,
                en: <> In identified volume, {fmtP(pc)} runs on models that declare reasoning.</>,
              });
          }} />
      </div>
      <p className="nota">{t({
        pt: <>
          <b style={{ color: 'var(--ink-2)' }}>O que se mede aqui.</b>{' '} Capacidade declarada, contada modelo a modelo no catálogo, satura: quando quase todo modelo anuncia suporte a ferramentas ou a raciocínio, contar modelos não separa nada. O que ainda se move é a carga, medida pelo volume: quanto do tráfego vai para modelo de janela longa, com entrada multimodal ou de raciocínio.
          {ni && <>{' '}A faixa cinza é a mesma nos três gráficos: é o volume em modelos sem registro no catálogo, {fmtP(ni[0])} em {fPer(R.eixo[0], g)} e {fmtP(ni[u])} em {fPer(R.eixo[u], g)}. Quando ela encolhe, as outras crescem só por isso, e por isso a leitura compara também só o volume identificado.</>}
          {' '}O catálogo informa se o modelo suporta raciocínio, não se ele é obrigatório, por isso o terceiro cartão mede suporte ponderado por volume. E os três descrevem o modelo, não a requisição: tráfego em modelo com janela acima de 400k não quer dizer prompt desse tamanho.
        </>,
        en: <>
          <b style={{ color: 'var(--ink-2)' }}>What is measured here.</b>{' '} Declared capability, counted model by model in the catalog, saturates: when nearly every model advertises tool or reasoning support, counting models separates nothing. What still moves is the workload, measured by volume: how much traffic goes to models with long context windows, multimodal input or reasoning.
          {ni && <>{' '}The gray band is the same in all three charts: it is volume in models with no catalog record, {fmtP(ni[0])} ({fPer(R.eixo[0], g)}) and {fmtP(ni[u])} ({fPer(R.eixo[u], g)}). When it shrinks, the others grow for that reason alone, which is why the reading also compares identified volume only.</>}
          {' '}The catalog says whether a model supports reasoning, not whether reasoning is mandatory, so the third card measures support weighted by volume. And all three describe the model, not the request: traffic on a model with a window over 400k does not mean prompts that long.
        </>,
      })}</p>
    </Secao>
  );
}
