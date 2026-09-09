"""Gera public/og.png, o card social de 1200x630, a partir de public/data.json.

Roda no fim do pipeline diario, entao o card que aparece no LinkedIn, no
WhatsApp e no X carrega os numeros do dia, nao um print congelado. Usa Pillow
em vez de headless browser porque precisa rodar em CI em segundos, sem baixar
navegador.

Uso: python pipeline/make_og.py
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data.json"
OUT = ROOT / "public" / "og.png"

W, H = 1200, 630
TINTA = (18, 20, 23)          # --ink
FUNDO = (250, 250, 251)
TINTA_2 = (75, 81, 96)        # --ink-2
TINTA_3 = (125, 131, 148)     # --ink-3
ACENTO = (25, 158, 112)       # --accent
LINHA = (227, 229, 234)       # --grid

CANDIDATAS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans{}.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans{}.ttf",
    "/Library/Fonts/DejaVuSans{}.ttf",
]


def fonte(tamanho: int, negrito: bool = False):
    sufixo = "-Bold" if negrito else ""
    for padrao in CANDIDATAS:
        caminho = Path(padrao.format(sufixo))
        if caminho.exists():
            return ImageFont.truetype(str(caminho), tamanho)
    print("AVISO: DejaVu nao encontrada, usando fonte padrao do Pillow.", file=sys.stderr)
    return ImageFont.load_default()


def br(iso: str) -> str:
    return "/".join(reversed(iso.split("-")))


def main() -> int:
    if not DATA.exists():
        print(f"ERRO: {DATA} nao existe. Rode pipeline/build.py antes.", file=sys.stderr)
        return 1
    d = json.load(open(DATA))

    volume = d["weekly_total_T"][-1]
    china = d["origin_share"]["China"][-1]
    abertos = d["weights_share"]["Open-weights"][-1]
    rotativ = d["churn"][-1]

    img = Image.new("RGB", (W, H), FUNDO)
    dr = ImageDraw.Draw(img)

    # Faixa de acento no topo
    dr.rectangle([0, 0, W, 8], fill=ACENTO)

    m = 72  # margem

    dr.text((m, 74), "INTELIGÊNCIA DE MERCADO · MODELOS DE LINGUAGEM",
            font=fonte(19, True), fill=TINTA_3)

    dr.text((m, 116), "Model Season", font=fonte(78, True), fill=TINTA)

    dr.text((m, 218),
            "Para onde vai o tráfego de tokens dos modelos de linguagem,",
            font=fonte(30), fill=TINTA_2)
    dr.text((m, 258), "semana a semana. Atualizado todo dia.",
            font=fonte(30), fill=TINTA_2)

    dr.line([m, 336, W - m, 336], fill=LINHA, width=2)

    metricas = [
        (f"{volume:.0f}T", "tokens por semana"),
        (f"{china:.0f}%", "laboratórios chineses"),
        (f"{abertos:.0f}%", "pesos abertos"),
        (f"{rotativ}/10", "trocam a cada 4 semanas"),
    ]
    largura = (W - 2 * m) // len(metricas)
    for i, (valor, rotulo) in enumerate(metricas):
        x = m + i * largura
        dr.text((x, 380), valor, font=fonte(56, True), fill=TINTA)
        dr.text((x, 452), rotulo, font=fonte(21), fill=TINTA_3)

    dr.line([m, 528, W - m, 528], fill=LINHA, width=2)

    dr.text((m, 556), "modelseason.com", font=fonte(25, True), fill=ACENTO)
    rodape = f"Dados: OpenRouter · CC BY 4.0 · as of {br(d['as_of'])}"
    caixa = dr.textbbox((0, 0), rodape, font=fonte(21))
    dr.text((W - m - (caixa[2] - caixa[0]), 559), rodape, font=fonte(21), fill=TINTA_3)

    img.save(OUT, "PNG", optimize=True)
    print(f"og.png gerado: {OUT.stat().st_size // 1024}KB · "
          f"{volume:.0f}T · China {china:.0f}% · abertos {abertos:.0f}% · churn {rotativ}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
