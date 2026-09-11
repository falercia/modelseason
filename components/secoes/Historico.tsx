'use client';
import type { DadosV1 } from '@/lib/engine';
import type { Mercado } from '@/lib/tipos';
import { BarraFiltros, HistoricoProvider } from '@/components/shell/Historico';
import S01 from './S01';
import S02 from './S02';
import S03 from './S03';
import S04 from './S04';
import S05 from './S05';
import S06 from './S06';
import S07 from './S07';
import S08 from './S08';
import S09 from './S09';
import S10 from './S10';
import S11 from './S11';
import S12 from './S12';
import S13 from './S13';
import S14 from './S14';
import S15 from './S15';

export function Historico({ D, M }: { D: DadosV1; M: Mercado }) {
  return (
    <HistoricoProvider D={D}>
      <div className="split" id="historico">
        <h2>Histórico</h2>
        <p>Daqui para baixo tudo responde à janela, ao agrupamento e aos filtros. Semanas completas, desde janeiro de 2025.</p>
        <span className="ln" />
      </div>
      <BarraFiltros />
      <S01 M={M} />
      <S02 M={M} />
      <S03 M={M} />
      <S04 M={M} />
      <S05 M={M} />
      <S06 M={M} />
      <S07 M={M} />
      <S08 M={M} />
      <S09 M={M} />
      <S10 M={M} />
      <S11 M={M} />
      <S12 M={M} />
      <S13 M={M} />
      <S14 M={M} />
      <S15 M={M} />
    </HistoricoProvider>
  );
}
