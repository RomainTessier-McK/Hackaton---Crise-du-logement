#!/usr/bin/env python3
"""
Filter Statistics Canada Census CSV data by GEO_NAME (Forward Sortation Area) prefix.

Keeps rows where GEO_NAME starts with one of the configured prefixes
(default: H, J3T, J3X, J3Z, J4, J5, J6, J7).
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

DEFAULT_PREFIXES = ("H", "J3T", "J3X", "J3Z", "J4", "J5", "J6", "J7")
GEO_NAME_COLUMN = "GEO_NAME"


def matches_geo_prefix(geo_name: str, prefixes: tuple[str, ...]) -> bool:
    return any(geo_name.startswith(prefix) for prefix in prefixes)


def filter_csv(
    input_path: Path,
    output_path: Path,
    prefixes: tuple[str, ...],
    encoding: str = "latin-1",
    progress_every: int = 500_000,
) -> tuple[int, int, set[str]]:
    """Stream input CSV and write matching rows to output CSV."""
    rows_read = 0
    rows_written = 0
    matched_geos: set[str] = set()

    with input_path.open("r", encoding=encoding, newline="") as infile, output_path.open(
        "w", encoding="utf-8", newline=""
    ) as outfile:
        reader = csv.DictReader(infile)
        if reader.fieldnames is None:
            raise ValueError(f"No header row found in {input_path}")

        if GEO_NAME_COLUMN not in reader.fieldnames:
            raise ValueError(
                f"Column '{GEO_NAME_COLUMN}' not found. Available columns: {reader.fieldnames}"
            )

        writer = csv.DictWriter(outfile, fieldnames=reader.fieldnames)
        writer.writeheader()

        for row in reader:
            rows_read += 1
            geo_name = row[GEO_NAME_COLUMN]

            if matches_geo_prefix(geo_name, prefixes):
                writer.writerow(row)
                rows_written += 1
                matched_geos.add(geo_name)

            if progress_every and rows_read % progress_every == 0:
                print(
                    f"  processed {rows_read:,} rows, kept {rows_written:,}...",
                    file=sys.stderr,
                )

    return rows_read, rows_written, matched_geos


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Filter census CSV rows by GEO_NAME prefix."
    )
    parser.add_argument(
        "input",
        nargs="?",
        default="98-401-X2021013_eng_CSV/98-401-X2021013_English_CSV_data.csv",
        help="Path to the source CSV file",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="98-401-X2021013_eng_CSV/98-401-X2021013_English_CSV_data_filtered.csv",
        help="Path for the filtered output CSV",
    )
    parser.add_argument(
        "--prefix",
        action="append",
        dest="prefixes",
        help="GEO_NAME prefix to keep (repeatable). Defaults to H, J3T, J3X, J3Z, J4-J7.",
    )
    parser.add_argument(
        "--encoding",
        default="latin-1",
        help="Input file encoding (default: latin-1 for Statistics Canada CSV exports)",
    )
    parser.add_argument(
        "--progress-every",
        type=int,
        default=500_000,
        help="Print progress every N rows (0 to disable)",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    prefixes = tuple(args.prefixes) if args.prefixes else DEFAULT_PREFIXES

    if not input_path.is_file():
        print(f"Error: input file not found: {input_path}", file=sys.stderr)
        return 1

    output_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Input:    {input_path}", file=sys.stderr)
    print(f"Output:   {output_path}", file=sys.stderr)
    print(f"Prefixes: {', '.join(prefixes)}", file=sys.stderr)
    print("Filtering...", file=sys.stderr)

    rows_read, rows_written, matched_geos = filter_csv(
        input_path,
        output_path,
        prefixes,
        encoding=args.encoding,
        progress_every=args.progress_every,
    )

    print(file=sys.stderr)
    print(f"Done.", file=sys.stderr)
    print(f"  Rows read:    {rows_read:,}", file=sys.stderr)
    print(f"  Rows kept:    {rows_written:,}", file=sys.stderr)
    print(f"  GEO_NAME values matched ({len(matched_geos)}):", file=sys.stderr)
    for geo in sorted(matched_geos):
        print(f"    - {geo}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
