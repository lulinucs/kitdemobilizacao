"""Inventaria public/midia sem alterar os arquivos originais."""

from __future__ import annotations

import base64
import csv
import hashlib
import html
import io
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import quote

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MEDIA = ROOT / "public" / "midia"
sys.path.insert(0, str(HERE / ".deps"))

try:
    import fitz  # PyMuPDF, instalado apenas em scripts/midia/.deps
    from PIL import Image, ImageOps
except ImportError as exc:
    raise SystemExit(
        "Dependências ausentes. Instale localmente com: "
        "python -m pip install --target scripts/midia/.deps -r scripts/midia/requirements.txt"
    ) from exc

ALLOWED_FOLDERS = {"GUIAS-MANUAIS", "LAMBES-CARTAZES", "WEB"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
GENERIC_NAME = re.compile(
    r"^(?:img(?:[-_ ]|\d)|whatsapp[ _-]*image|ht[0-9a-z_-]{8,}|"
    r"temp[ _-]*image|picsart|unnamed(?:[-_ ]|$)|prancheta[ _-]*\d+|"
    r"lamb\d+|fbx[a-z]+|"
    r"[0-9a-f]{8}-[0-9a-f-]{27,}|\d+(?:[ _-]*\(\d+\))?$)",
    re.IGNORECASE,
)


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def windows_key(value: str) -> str:
    return unicodedata.normalize("NFC", value).casefold()


def safe_slug(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    value = value.lower().replace("&", " e ")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    # Número de uma série gráfica: 01, 02, ...; números temáticos como 6x1 permanecem.
    value = re.sub(r"-(\d)$", lambda match: f"-0{match.group(1)}", value)
    return value


def proposal(path: Path) -> tuple[str, str, str]:
    stem = path.stem
    extension = path.suffix.lower()
    if stem.lower().endswith(extension):
        stem = stem[: -len(extension)]

    author_series = re.fullmatch(r"(?:([0-9]+)-@laragabos|@laragabos\s*\(([0-9]+)\))", stem, re.IGNORECASE)
    if author_series and path.parent.name == "LAMBES-CARTAZES" and extension == ".pdf":
        number = int(author_series.group(1) or author_series.group(2))
        name = f"laragabos-cartaz-{number:02d}.pdf"
        return name, "REVISAR", "Série de autoria preservada; conferir conteúdo e colisões entre variantes de nome"

    if GENERIC_NAME.match(stem) or re.fullmatch(r"@[a-z0-9_]+", stem, re.IGNORECASE):
        return "", "REVISAR", "Nome genérico ou apenas autoria; identificar visualmente sem inferir conteúdo"

    name = f"{safe_slug(stem)}{extension}"
    if not name or name == extension:
        return "", "REVISAR", "Nome sem informação suficiente para uma proposta segura"
    if stem.lower().startswith("cópia de ") or stem.lower().startswith("copia de "):
        return name, "REVISAR", "Possível cópia ou variante; conferir antes de renomear"
    if name == path.name:
        return name, "SEM_ALTERACAO", "Nome já segue a convenção"
    return name, "AUTOMATICO", "Normalização de caixa, acentos, separadores e extensão"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def image_preview(image: Image.Image) -> tuple[str, tuple[int, tuple[int, int, int], float]]:
    image = ImageOps.exif_transpose(image)
    if image.mode == "RGBA":
        background = Image.new("RGB", image.size, "white")
        background.paste(image, mask=image.getchannel("A"))
        image = background
    else:
        image = image.convert("RGB")
    ratio = image.width / image.height
    small = image.copy()
    small.thumbnail((260, 210))
    output = io.BytesIO()
    small.save(output, format="JPEG", quality=74, optimize=True)
    preview = "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode("ascii")

    pixels = image.resize((9, 8)).convert("L")
    bits = 0
    for y in range(8):
        for x in range(8):
            bits = (bits << 1) | (pixels.getpixel((x, y)) > pixels.getpixel((x + 1, y)))
    color = image.resize((1, 1)).getpixel((0, 0))
    return preview, (bits, color, ratio)


def inspect(path: Path) -> tuple[str, str, str, list[str], tuple[int, tuple[int, int, int], float] | None, str]:
    extension = path.suffix.lower()
    problems: list[str] = []
    width = height = pages = ""
    preview = ""
    signature = None
    try:
        if extension in IMAGE_EXTENSIONS:
            with Image.open(path) as source:
                width, height = source.size
                expected = {".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG", ".webp": "WEBP"}[extension]
                if source.format != expected:
                    problems.append(f"Extensão {extension} não corresponde ao formato {source.format}")
                if width * height > 100_000_000:
                    problems.append("Imagem com mais de 100 megapixels")
                preview, signature = image_preview(source)
        elif extension == ".pdf":
            with fitz.open(path) as document:
                pages = str(document.page_count)
                if document.needs_pass:
                    problems.append("PDF protegido por senha")
                elif document.page_count:
                    page = document[0]
                    scale = min(1.5, 500 / max(page.rect.width, page.rect.height))
                    pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
                    image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
                    preview, signature = image_preview(image)
                else:
                    problems.append("PDF sem páginas")
        else:
            problems.append("Extensão não suportada para prévia")
    except Exception as exc:  # erro registrado no inventário, sem descartar o arquivo
        problems.append(f"Não foi possível abrir: {type(exc).__name__}: {exc}")
    if path.stat().st_size > 25 * 1024 * 1024:
        problems.append("Arquivo acima de 25 MiB; conferir adequação para uso futuro")
    return str(width), str(height), pages, problems, signature, preview


def write_csv(path: Path, headers: list[str], rows: list[dict[str, object]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    if not MEDIA.is_dir():
        raise SystemExit(f"Acervo não encontrado: {MEDIA}")
    files = sorted((p for p in MEDIA.rglob("*") if p.is_file()), key=lambda p: relative(p).casefold())
    outside = [p for p in files if p.is_symlink() or not p.resolve().is_relative_to(MEDIA.resolve())
               or p.relative_to(MEDIA).parts[0] not in ALLOWED_FOLDERS]
    if outside:
        raise SystemExit("Há arquivos fora das três categorias ou links simbólicos; revisar antes de continuar.")

    inventory = []
    renames = []
    cards = []
    signatures = []
    hashes: dict[str, list[str]] = defaultdict(list)
    for path in files:
        rel = relative(path)
        width, height, pages, problems, signature, preview = inspect(path)
        digest = sha256(path)
        hashes[digest].append(rel)
        proposed_name, situation, reason = proposal(path)
        if any(problem.startswith("Extensão ") for problem in problems):
            situation = "REVISAR"
            reason += "; extensão e formato real divergem, conferir antes de renomear"
        proposed = relative(path.with_name(proposed_name)) if proposed_name else ""
        if path.suffix.lower() not in IMAGE_EXTENSIONS | {".pdf"}:
            problems.append("Formato fora do escopo previsto")
        inventory.append({
            "arquivo_original": path.name,
            "caminho": rel,
            "extensao": path.suffix.lower(),
            "tamanho_bytes": path.stat().st_size,
            "largura_px": width,
            "altura_px": height,
            "paginas_pdf": pages,
            "sha256": digest,
            "problemas": " | ".join(problems),
        })
        renames.append({
            "caminho_original": rel,
            "caminho_proposto": proposed,
            "motivo": reason,
            "situacao": situation,
            "aprovado": "NAO" if situation == "AUTOMATICO" else "",
            "sha256_original": digest,
        })
        cards.append((rel, proposed, situation, path.stat().st_size, width, height, pages, preview))
        if signature:
            signatures.append((rel, digest, signature))

    # Colisões com o acervo existente e entre propostas, segundo comparação sem caixa do Windows.
    current = {windows_key(row["caminho"]): row["caminho"] for row in inventory}
    by_target: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in renames:
        if row["caminho_proposto"]:
            by_target[windows_key(row["caminho_proposto"])].append(row)
    conflicts = []
    for key, rows in by_target.items():
        target_owners = {windows_key(row["caminho_original"]) for row in rows}
        existing = current.get(key)
        collision = len(target_owners) > 1 or (existing is not None and windows_key(existing) not in target_owners)
        if collision:
            conflicts.append((rows[0]["caminho_proposto"], [row["caminho_original"] for row in rows], existing))
            for row in rows:
                if row["situacao"] != "SEM_ALTERACAO":
                    row["situacao"] = "REVISAR"
                    row["aprovado"] = ""
                    row["motivo"] += "; colisão de nome no Windows"

    duplicates = []
    exact_groups = [paths for paths in hashes.values() if len(paths) > 1]
    for group_number, paths in enumerate(sorted(exact_groups, key=lambda paths: paths[0]), 1):
        for path in paths:
            entry = next(row for row in inventory if row["caminho"] == path)
            duplicates.append({
                "grupo": f"D{group_number:03d}", "sha256": entry["sha256"],
                "arquivos_no_grupo": len(paths), "caminho": path,
                "tamanho_bytes": entry["tamanho_bytes"],
            })

    visual = []
    for index, (left, left_sha, (left_hash, left_color, left_ratio)) in enumerate(signatures):
        for right, right_sha, (right_hash, right_color, right_ratio) in signatures[index + 1:]:
            if left_sha == right_sha or abs(left_ratio - right_ratio) > 0.08:
                continue
            distance = (left_hash ^ right_hash).bit_count()
            color_distance = max(abs(a - b) for a, b in zip(left_color, right_color))
            if distance <= 4 and color_distance <= 22:
                visual.append({"caminho_a": left, "caminho_b": right,
                               "distancia_visual": distance, "diferenca_cor": color_distance,
                               "observacao": "Sugestão visual; conferir manualmente. Não implica duplicata exata."})
    visual.sort(key=lambda row: (row["distancia_visual"], row["diferenca_cor"]))

    write_csv(HERE / "inventario.csv", list(inventory[0]), inventory)
    write_csv(HERE / "renomeacoes.csv", list(renames[0]), renames)
    write_csv(HERE / "duplicatas.csv", ["grupo", "sha256", "arquivos_no_grupo", "caminho", "tamanho_bytes"], duplicates)
    write_csv(HERE / "possiveis-duplicatas-visuais.csv", ["caminho_a", "caminho_b", "distancia_visual", "diferenca_cor", "observacao"], visual)
    write_report(inventory, renames, exact_groups, conflicts, visual)
    write_html(cards, renames)
    counts = Counter(row["situacao"] for row in renames)
    print(f"{len(files)} arquivos; {counts['AUTOMATICO']} automáticos; {counts['REVISAR']} para revisão; "
          f"{len(exact_groups)} grupos de duplicatas exatas; {len(conflicts)} conflitos.")
    print("Simulação apenas: nenhum arquivo em public/midia/ foi alterado.")


def write_report(inventory, renames, exact_groups, conflicts, visual) -> None:
    count_by_folder = Counter(Path(row["caminho"]).parts[2] for row in inventory)
    count_by_extension = Counter(row["extensao"] for row in inventory)
    count_by_pair = Counter((Path(row["caminho"]).parts[2], row["extensao"]) for row in inventory)
    bytes_by_folder = Counter()
    for row in inventory:
        bytes_by_folder[Path(row["caminho"]).parts[2]] += row["tamanho_bytes"]
    statuses = Counter(row["situacao"] for row in renames)
    problems = [row for row in inventory if row["problemas"]]
    largest = sorted(inventory, key=lambda row: row["tamanho_bytes"], reverse=True)[:10]

    lines = [
        "# Relatório do acervo de mídias", "",
        "Inventário somente de leitura dos originais em `public/midia/`. Nenhuma renomeação foi aplicada.", "",
        f"- **Arquivos:** {len(inventory)} ({sum(row['tamanho_bytes'] for row in inventory) / 2**20:.1f} MiB)",
        f"- **Nomes automáticos:** {statuses['AUTOMATICO']}",
        f"- **Revisão necessária:** {statuses['REVISAR']}",
        f"- **Sem proposta de nome por falta de identificação:** {sum(not row['caminho_proposto'] for row in renames)}",
        f"- **Sem alteração:** {statuses['SEM_ALTERACAO']}",
        f"- **Duplicatas exatas:** {len(exact_groups)} grupos, {sum(len(group)-1 for group in exact_groups)} cópias adicionais; nenhum arquivo será apagado",
        f"- **Conflitos de nome:** {len(conflicts)} propostas conflitantes",
        f"- **Possíveis semelhanças visuais:** {len(visual)} pares para revisão manual", "",
        "## Por pasta", "", "| Pasta | Arquivos | MiB |", "| --- | ---: | ---: |",
    ]
    for folder, count in sorted(count_by_folder.items()):
        lines.append(f"| {folder} | {count} | {bytes_by_folder[folder] / 2**20:.1f} |")
    extensions = sorted(count_by_extension)
    lines += ["", "## Por pasta e extensão", "",
              "| Pasta | " + " | ".join(extensions) + " |",
              "| --- | " + " | ".join("---:" for _ in extensions) + " |"]
    for folder in sorted(count_by_folder):
        lines.append("| " + folder + " | " + " | ".join(str(count_by_pair[(folder, extension)]) for extension in extensions) + " |")
    lines += ["", "## Por extensão", "", "| Extensão | Arquivos |", "| --- | ---: |"]
    for extension, count in sorted(count_by_extension.items()):
        lines.append(f"| {extension} | {count} |")
    lines += ["", "## Arquivos maiores", "", "| Caminho | MiB |", "| --- | ---: |"]
    for row in largest:
        lines.append(f"| `{row['caminho']}` | {row['tamanho_bytes'] / 2**20:.1f} |")
    lines += ["", "## Arquivos potencialmente problemáticos", ""]
    if problems:
        for row in problems[:30]:
            lines.append(f"- `{row['caminho']}`: {row['problemas']}")
        if len(problems) > 30:
            lines.append(f"- Outros {len(problems) - 30} registros estão detalhados em `inventario.csv`.")
    else:
        lines.append("Nenhum arquivo corrompido ou fora dos limites de inspeção foi encontrado.")
    lines += ["", "## Conflitos de nomes", ""]
    if conflicts:
        for target, sources, existing in conflicts[:30]:
            lines.append(f"- `{target}` ← {', '.join(f'`{source}`' for source in sources)}" +
                         (f"; já existe `{existing}`" if existing and existing not in sources else ""))
        if len(conflicts) > 30:
            lines.append(f"- Outros {len(conflicts) - 30} conflitos estão marcados em `renomeacoes.csv`.")
    else:
        lines.append("Nenhum.")
    lines += ["", "## Possíveis duplicatas visuais", "",
              "A distância visual usa miniaturas; pares semelhantes **não** são considerados duplicatas exatas nem serão removidos. Lista completa em `possiveis-duplicatas-visuais.csv`.", ""]
    for row in visual[:25]:
        lines.append(f"- `{row['caminho_a']}` ↔ `{row['caminho_b']}` (distância {row['distancia_visual']})")
    if not visual:
        lines.append("Nenhum par passou pelo limiar conservador.")
    lines += ["", "## Decisões pendentes", "",
              "- Abrir `revisao.html` para identificar visualmente nomes de câmera, WhatsApp, UUIDs, arquivos numerados e PDFs de autoria sem tema no nome.",
              "- Resolver colisões sem sufixos arbitrários; propostas conflitantes permanecem como `REVISAR`.",
              "- Conferir as duplicatas exatas e visuais; nenhuma exclusão está prevista.",
              "- Para aplicar futuramente, marcar `aprovado=SIM` apenas nas linhas `AUTOMATICO` de `renomeacoes.csv` e executar `python scripts/midia/renomear.py --apply`.",
              "- O modo padrão `python scripts/midia/renomear.py` é somente simulação. O manifesto de cada aplicação fica em `scripts/midia/manifestos/`; o procedimento de recuperação está no `README.md` desta pasta.", ""]
    (HERE / "relatorio.md").write_text("\n".join(lines), encoding="utf-8")


def write_html(cards, renames) -> None:
    situation_by_path = {row["caminho_original"]: row["situacao"] for row in renames}
    proposal_by_path = {row["caminho_original"]: row["caminho_proposto"] for row in renames}
    parts = ["""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Revisão local do acervo · Kit de Mobilização</title><style>
:root{font-family:system-ui,sans-serif;color:#263d38;background:#fff9ed}*{box-sizing:border-box}body{margin:0;padding:24px;max-width:1500px;margin:auto}h1{margin:0 0 6px;font-size:clamp(1.5rem,3vw,2.3rem)}p{line-height:1.5}.controls{display:flex;flex-wrap:wrap;gap:12px;margin:20px 0}.controls input,.controls select{font:inherit;padding:10px;border:1px solid #8d9c93;border-radius:5px;min-height:44px}.controls input{flex:1;min-width:220px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}.card{border:1px solid #d7cdbb;border-radius:8px;padding:12px;background:#fff;min-width:0}.preview{height:210px;display:grid;place-items:center;background:#f1eadc;border-radius:4px;overflow:hidden}.preview img{max-width:100%;max-height:100%;object-fit:contain}.card h2{font-size:.96rem;overflow-wrap:anywhere;margin:10px 0 5px}.card p{font-size:.84rem;margin:5px 0;overflow-wrap:anywhere}.meta{color:#526960}.badge{display:inline-block;font-size:.72rem;font-weight:700;background:#e7f1ea;padding:3px 6px;border-radius:3px}.badge.revisar{background:#f4c542}.card a{color:#226b58;text-decoration:underline;text-underline-offset:2px}.empty{display:none}
</style></head><body><h1>Revisão local do acervo</h1><p>Prévia para identificação. Os originais permanecem intactos. Por padrão, aparecem apenas os arquivos que precisam de revisão.</p><div class="controls"><input id="query" type="search" placeholder="Buscar por nome ou pasta" aria-label="Buscar arquivos"><select id="filter" aria-label="Filtrar situação"><option value="REVISAR">Precisam de revisão</option><option value="TODOS">Todos os arquivos</option><option value="AUTOMATICO">Normalização automática</option><option value="SEM_ALTERACAO">Sem alteração</option></select><span id="count" aria-live="polite"></span></div><div class="grid" id="grid">"""]
    for rel, _, _, size, width, height, pages, preview in cards:
        situation = situation_by_path[rel]
        proposed = proposal_by_path[rel]
        href = "../../" + "/".join(quote(part) for part in Path(rel).parts)
        description = f"{width} × {height} px" if width and height else f"{pages} página(s)" if pages else "Prévia indisponível"
        preview_html = f'<img loading="lazy" src="{preview}" alt="Prévia de {html.escape(Path(rel).name, quote=True)}">' if preview else "Prévia indisponível"
        parts.append(f'<article class="card" data-status="{situation}" data-search="{html.escape(rel.casefold(), quote=True)}"><div class="preview">{preview_html}</div><span class="badge {"revisar" if situation == "REVISAR" else ""}">{situation}</span><h2>{html.escape(Path(rel).name)}</h2><p class="meta">{html.escape(rel)}<br>{description} · {size / 2**20:.2f} MiB</p>' +
                     (f'<p><strong>Proposto:</strong> {html.escape(proposed)}</p>' if proposed else "") +
                     f'<p><a href="{href}" target="_blank" rel="noopener">Abrir original</a></p></article>')
    parts.append("""</div><script>const q=document.querySelector('#query'),f=document.querySelector('#filter'),c=document.querySelector('#count');function update(){let n=0;for(const card of document.querySelectorAll('.card')){const show=(f.value==='TODOS'||card.dataset.status===f.value)&&card.dataset.search.includes(q.value.toLocaleLowerCase('pt-BR'));card.hidden=!show;if(show)n++}c.textContent=n+' arquivo(s)'}q.addEventListener('input',update);f.addEventListener('change',update);update();</script></body></html>""")
    (HERE / "revisao.html").write_text("\n".join(parts), encoding="utf-8")


if __name__ == "__main__":
    main()
