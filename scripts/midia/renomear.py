"""Simula por padrão; aplica só linhas AUTOMATICO com aprovado=SIM."""

from __future__ import annotations

import argparse
import csv
import hashlib
import os
import sys
import unicodedata
from datetime import datetime
from pathlib import Path, PurePosixPath
from uuid import uuid4

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MEDIA = (ROOT / "public" / "midia").resolve()
PLAN = HERE / "renomeacoes.csv"
MANIFESTS = HERE / "manifestos"
ALLOWED_FOLDERS = {"GUIAS-MANUAIS", "LAMBES-CARTAZES", "WEB"}


def key(path: str) -> str:
    return unicodedata.normalize("NFC", path).casefold()


def safe_path(relative: str) -> Path:
    parts = PurePosixPath(relative).parts
    if len(parts) < 4 or parts[:2] != ("public", "midia") or parts[2] not in ALLOWED_FOLDERS or ".." in parts:
        raise ValueError(f"Caminho fora do acervo: {relative}")
    path = ROOT.joinpath(*parts)
    if not path.resolve().is_relative_to(MEDIA) or path.is_symlink():
        raise ValueError(f"Caminho inseguro: {relative}")
    return path


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def preflight(rows: list[dict[str, str]]) -> list[tuple[dict[str, str], Path, Path]]:
    selected = []
    destinations = set()
    for row in rows:
        if row["situacao"] != "AUTOMATICO" or row["aprovado"].strip().upper() != "SIM":
            continue
        source = safe_path(row["caminho_original"])
        target = safe_path(row["caminho_proposto"])
        if source.parent != target.parent or source.suffix.lower() != target.suffix.lower():
            raise ValueError(f"Mudança de categoria ou formato recusada: {source}")
        if source.name == target.name or not source.is_file():
            raise ValueError(f"Origem ausente ou destino igual: {source}")
        if digest(source) != row["sha256_original"]:
            raise ValueError(f"Conteúdo mudou desde o inventário: {source}")
        destination_key = key(row["caminho_proposto"])
        if destination_key in destinations:
            raise ValueError(f"Duas aprovações têm o mesmo destino: {target}")
        destinations.add(destination_key)
        if target.exists() and not source.samefile(target):
            raise ValueError(f"Destino já ocupado: {target}")
        selected.append((row, source, target))
    return selected


def rename_without_overwrite(source: Path, target: Path) -> None:
    if target.exists() and not source.samefile(target):
        raise FileExistsError(target)
    # NTFS requer passo intermediário quando a única diferença é caixa ou normalização Unicode.
    if key(source.name) == key(target.name):
        temporary = source.with_name(f".midia-rename-{uuid4().hex}.tmp")
        if temporary.exists():
            raise FileExistsError(temporary)
        source.rename(temporary)
        try:
            temporary.rename(target)
        except Exception:
            temporary.rename(source)
            raise
    else:
        source.rename(target)


def apply(rows: list[dict[str, str]]) -> None:
    selected = preflight(rows)
    if not selected:
        print("Nenhuma linha AUTOMATICO com aprovado=SIM. Nada foi renomeado.")
        return
    MANIFESTS.mkdir(exist_ok=True)
    manifest = MANIFESTS / f"renomeacoes-{datetime.now().strftime('%Y%m%d-%H%M%S-%f')}.csv"
    with manifest.open("x", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["caminho_original", "caminho_novo", "sha256", "aplicado_em"])
        writer.writeheader()
        handle.flush()
        os.fsync(handle.fileno())
        for row, source, target in selected:
            rename_without_overwrite(source, target)
            writer.writerow({"caminho_original": row["caminho_original"], "caminho_novo": row["caminho_proposto"],
                             "sha256": row["sha256_original"], "aplicado_em": datetime.now().isoformat(timespec="seconds")})
            handle.flush()
            os.fsync(handle.fileno())
            print(f"RENOMEADO {row['caminho_original']} -> {row['caminho_proposto']}")
    print(f"Manifesto de recuperação: {manifest}")


def undo(manifest: Path) -> None:
    if not manifest.resolve().is_relative_to(MANIFESTS.resolve()):
        raise ValueError("O manifesto deve estar em scripts/midia/manifestos/")
    rows = read_csv(manifest)
    for row in reversed(rows):
        old = safe_path(row["caminho_original"])
        current = safe_path(row["caminho_novo"])
        if not current.is_file() or digest(current) != row["sha256"]:
            raise ValueError(f"Arquivo renomeado ausente ou alterado: {current}")
        if old.exists() and not current.samefile(old):
            raise FileExistsError(f"Nome anterior ocupado: {old}")
        rename_without_overwrite(current, old)
        print(f"RESTAURADO {row['caminho_novo']} -> {row['caminho_original']}")


def simulate(rows: list[dict[str, str]]) -> None:
    counts = {status: sum(row["situacao"] == status for row in rows)
              for status in ("AUTOMATICO", "REVISAR", "SEM_ALTERACAO")}
    for row in rows:
        if row["situacao"] == "SEM_ALTERACAO":
            continue
        target = row["caminho_proposto"] or "(identificação visual pendente)"
        print(f"{row['situacao']:10} {row['caminho_original']} -> {target}")
    print("\nResumo:", counts)
    print("Conflitos:", sum("colisão" in row["motivo"] for row in rows), "proposta(s) afetada(s)")
    print("Aprovações para futura aplicação:", sum(row["situacao"] == "AUTOMATICO" and row["aprovado"].strip().upper() == "SIM" for row in rows))
    print("Simulação: nenhum arquivo foi modificado.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="Aplicar apenas linhas AUTOMATICO com aprovado=SIM")
    mode.add_argument("--undo", type=Path, metavar="MANIFESTO", help="Restaurar os nomes do manifesto, em ordem inversa")
    args = parser.parse_args()
    try:
        if args.undo:
            undo(args.undo)
        else:
            rows = read_csv(PLAN)
            apply(rows) if args.apply else simulate(rows)
    except (ValueError, FileNotFoundError, FileExistsError, KeyError) as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
