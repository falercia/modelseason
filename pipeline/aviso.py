"""Aviso de pauta publicada: o comentario que o automerge.yml posta no PR logo depois do merge.

O comentario menciona o dono e sai pelo github-actions[bot], o que gera e-mail (o GitHub nao
avisa o dono do que ele mesmo faz, e com o PAUTA_TOKEN o merge sai no nome dele). Antes do
comentario o automerge troca o titulo do PR para "Publicada: Pauta do Radar AAAA-MM-DD", para o
e-mail chegar com assunto proprio em vez de cair calado na conversa do PR aberto (ate 10/11 os
avisos de sucesso ficavam todos sem ler).

So biblioteca padrao e movimentos.py (que tambem so usa a padrao): o automerge nao instala
dependencias. Uso: python3 pipeline/aviso.py data/pauta/AAAA-MM-DD.json DONO
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import movimentos  # noqa: E402

SITE = "https://modelseason.com"


def aviso(p, dono, site=SITE):
    """Markdown do comentario: confirmacao, link da edicao e o que saiu, em uma linha por item."""
    dia = p["dia"]
    L = [f"@{dono} A pauta de {dia} foi publicada com sucesso: {site}/radar/{dia} (o site atualiza em poucos minutos).", ""]
    ass, ms = p.get("assuntos") or [], p.get("movimentos") or []
    if ass:
        L += [f"**Notícias ({len(ass)})**", ""]
        L += [f"- {a['pt']['titulo']}" + (" (estreia no ranking)" if a.get("estreia") else "") for a in ass]
        L.append("")
    if ms:
        L += [f"**Movimentos dos laboratórios ({len(ms)})**", ""]
        L += [f"- {movimentos.LABS.get(m['lab'], {}).get('nome', m['lab'])}: {m['pt']['titulo']}" for m in ms]
        L.append("")
    if not ass and not ms:
        L += ["Edição só com o dado do dia.", ""]
    acoes = (p.get("editor") or {}).get("acoes") or []
    conta = {k: sum(1 for a in acoes if a.startswith(k)) for k in ("Corrigido", "Retirado", "Barrado")}
    if any(conta.values()):
        L.append(f"Editor: {conta['Corrigido']} corrigido(s), {conta['Retirado']} retirado(s) e "
                 f"{conta['Barrado']} barrado(s) antes da redação. Detalhes no PR.")
    return "\n".join(L).rstrip() + "\n"


def main(argv=None):
    a = argv if argv is not None else sys.argv[1:]
    if len(a) != 2:
        print("uso: aviso.py PAUTA.json DONO", file=sys.stderr)
        return 2
    sys.stdout.write(aviso(json.loads(Path(a[0]).read_text()), a[1]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
