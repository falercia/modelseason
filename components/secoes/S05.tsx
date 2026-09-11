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
import type { Gran, Recorte, Series } from '@/lib/engine';
import { Cartao, Secao } from '@/components/shell/Cartao';
import { useHistorico } from '@/components/shell/Historico';
import { Legenda, TabelaSerie, Temporal, type ItemSerie } from '@/components/graficos/base';
import { fPer, fmtP } from '@/lib/format';

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

/** Séries na ordem da pilha; categoria que o recorte não tem fica fora. Categoria desconhecida vai para baixo do cinza. */
function montar(S: Series, d: Dim): ItemSerie[] {
  const conhecidas = d.ordem.map(([k]) => k);
  const extras = Object.keys(S).filter(k => !conhecidas.includes(k));
  const ordem: [string, string][] = [...d.ordem.filter(([k]) => k !== NI), ...extras.map(k => [k, '--s0'] as [string, string]), ...d.ordem.filter(([k]) => k === NI)];
  return ordem.filter(([k]) => S[k] && S[k].some(v => v > 0)).map(([k, slot]) => ({ key: k, label: k, values: S[k], slot }));
}

const nomePer = (g: Gran) => (g === 'mes' ? { um: 'mês', uns: 'meses' } : { um: 'semana', uns: 'semanas' });

/** Share só entre o volume com metadado: tira a faixa cinza do denominador. */
const semNI = (S: Series, k: string, i: number) => {
  const ni = S[NI]?.[i] ?? 0, v = S[k]?.[i] ?? 0;
  return ni < 100 ? (100 * v) / (100 - ni) : null;
};

function Leitura({ S, d, R, extra }: { S: Series; d: Dim; R: Recorte; extra?: ReactNode }) {
  const u = R.N - 1, g = R.estado.gran;
  const cats = Object.keys(S).filter(k => k !== NI);
  const val = (k: string, i: number) => S[k]?.[i] ?? 0;
  const foco = cats.includes(d.foco) ? d.foco : [...cats].sort((a, b) => val(b, u) - val(a, u))[0];
  if (!foco) return <p className="leitura">Nenhum volume no recorte atual.</p>;
  // A categoria que mais se moveu, quando não é a mesma do foco.
  const mexeu = cats.filter(k => k !== foco).sort((a, b) => Math.abs(val(b, u) - val(b, 0)) - Math.abs(val(a, u) - val(a, 0)))[0];
  const dm = mexeu ? val(mexeu, u) - val(mexeu, 0) : 0;
  const ni0 = S[NI]?.[0] ?? 0, niU = S[NI]?.[u] ?? 0;
  const f0 = semNI(S, foco, 0), fU = semNI(S, foco, u);
  const verbo = (a: number, b: number) => (b > a ? 'subiu' : b < a ? 'caiu' : 'ficou');
  return (
    <div className="leitura">
      {R.cobertura.filtrando && <span className="pill" style={{ marginLeft: 0, marginRight: 6 }}>recorte</span>}
      <b>{foco}</b> {verbo(val(foco, 0), val(foco, u))} de {fmtP(val(foco, 0))} para <b>{fmtP(val(foco, u))}</b> do volume entre {fPer(R.eixo[0], g)} e {fPer(R.eixo[u], g)}
      {Math.abs(ni0 - niU) >= 10 && f0 != null && fU != null ? <>; só no volume identificado, de {fmtP(f0)} para {fmtP(fU)}.</> : '.'}
      {mexeu && Math.abs(dm) >= 1 && <> {mexeu} {verbo(val(mexeu, 0), val(mexeu, u))} de {fmtP(val(mexeu, 0))} para {fmtP(val(mexeu, u))}.</>}
      {S[NI] ? <> Não identificado no fim da janela: <b>{fmtP(niU)}</b>.</> : <> Sem faixa cinza: o filtro ativo já exclui os modelos sem metadado.</>}
      {extra}
    </div>
  );
}

function CartaoCarga({ id, d, subtitulo, extra, altura = 210 }: { id: string; d: Dim; subtitulo: string; extra?: (S: Series, R: Recorte) => ReactNode; altura?: number }) {
  const { R } = useHistorico();
  const S = R[d.chave];
  const series = montar(S, d);
  const g = R.estado.gran;
  const total = series.reduce((s, x) => s + (x.values.at(-1) ?? 0), 0);
  return (
    <Cartao id={id} novo subtitulo={subtitulo}>
      {!series.length || total === 0 ? <p className="vazio">Nenhum volume no recorte atual.</p> : (
        <>
          <Legenda itens={series} />
          <Temporal eixo={R.eixo} gran={g} series={series} modo="empilhada" ymax={100} altura={altura}
            fmt={v => fmtP(v)} fmtEixo={v => v + '%'} m={{ t: 10, r: 8, b: 26, l: 38 }}
            rotuloAria={`Área empilhada 100%: share do volume por ${id === 'carga-contexto' ? 'faixa de janela de contexto' : id === 'carga-modalidade' ? 'modalidade de entrada' : 'raciocínio declarado'}, de ${fPer(R.eixo[0], g)} a ${fPer(R.eixo[R.N - 1], g)}.`} />
          <Leitura S={S} d={d} R={R} extra={extra?.(S, R)} />
          <TabelaSerie eixo={R.eixo} gran={g} series={[...series].reverse()} fmt={v => fmtP(v)} />
        </>
      )}
    </Cartao>
  );
}

export default function S05(_: { M: Mercado }) {
  const { R } = useHistorico();
  const p = nomePer(R.estado.gran), u = R.N - 1, g = R.estado.gran;
  const ni = R.faixa_ctx_share[NI];
  return (
    <Secao id="s05" n="05" titulo="Que carga o tráfego exige"
      sub={<>Share do volume de cada {p.um} pelo atributo do modelo que atendeu o tráfego: janela de contexto máxima, modalidade de entrada e raciocínio declarado. Responde à janela, ao agrupamento e aos filtros.</>}>
      {/* Contexto na largura toda: é o atributo que mais se move. Em três colunas o eixo do tempo fica com uma marca só. */}
      <CartaoCarga id="carga-contexto" d={CONTEXTO} altura={240} subtitulo="% do volume por janela de contexto máxima do modelo" />
      <div className="grid2" style={{ marginTop: 14 }}>
        <CartaoCarga id="carga-modalidade" d={MODALIDADE} subtitulo="% do volume em modelos que aceitam só texto ou também imagem, áudio ou arquivo" />
        <CartaoCarga id="carga-raciocinio" d={RACIOCINIO} subtitulo="% do volume em modelos que declaram suporte a raciocínio no catálogo"
          extra={(S, R) => {
            const u = R.N - 1, c = S['Com raciocínio']?.[u] ?? 0, s = S['Sem raciocínio']?.[u] ?? 0;
            if (c + s <= 0) return null;
            const pc = (100 * c) / (c + s);
            return pc >= 90
              ? <> No volume identificado, {fmtP(pc)} já roda em modelo que declara raciocínio: o atributo saturou e não separa mais um tráfego do outro.</>
              : <> No volume identificado, {fmtP(pc)} roda em modelo que declara raciocínio.</>;
          }} />
      </div>
      <p className="nota">
        <b style={{ color: 'var(--ink-2)' }}>O que se mede aqui.</b>{' '} Capacidade declarada, contada modelo a modelo no catálogo, satura: quando quase todo modelo anuncia suporte a ferramentas ou a raciocínio, contar modelos não separa nada. O que ainda se move é a carga, medida pelo volume: quanto do tráfego vai para modelo de janela longa, com entrada multimodal ou de raciocínio.
        {ni && <>{' '}A faixa cinza é a mesma nos três gráficos: é o volume em modelos sem registro no catálogo, {fmtP(ni[0])} em {fPer(R.eixo[0], g)} e {fmtP(ni[u])} em {fPer(R.eixo[u], g)}. Quando ela encolhe, as outras crescem só por isso, e por isso a leitura compara também só o volume identificado.</>}
        {' '}O catálogo informa se o modelo suporta raciocínio, não se ele é obrigatório, por isso o terceiro cartão mede suporte ponderado por volume. E os três descrevem o modelo, não a requisição: tráfego em modelo com janela acima de 400k não quer dizer prompt desse tamanho.
      </p>
    </Secao>
  );
}
