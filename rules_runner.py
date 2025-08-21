#!/usr/bin/env python3

import sys
import json
import os
import argparse
from pathlib import Path
from typing import Dict, List
from dotenv import load_dotenv
from concurrent.futures import ProcessPoolExecutor

load_dotenv()

if __package__ is None or __package__ == "":
    sys.path.append(str(Path(__file__).resolve().parents[1]))
    from rules_generator import extract_rules_for_html, extract_rules_for_pdf
    from pin_table import extract_pin_tables
    from identify import identify_file
else:
    from .rules_generator import extract_rules_for_html, extract_rules_for_pdf
    from .pin_table import extract_pin_tables
    from .identify import identify_file

OUT_DIR = Path('output')

def run_one(file_path: Path, output_dir: Path = None) -> Dict[str, str]:
    try:
        # Use provided output_dir or fall back to global OUT_DIR
        out_dir = output_dir if output_dir is not None else OUT_DIR
        
        if file_path.suffix.lower() not in {'.html', '.htm', '.pdf'}:
            return {"file": file_path.name, "status": "skipped", "reason": "unsupported extension"}

        # Check if corresponding JSON output already exists
        out_path = out_dir / f"{file_path.stem}.json"
        if out_path.exists():
            return {"file": file_path.name, "status": "skipped", "reason": "output already exists", "out": str(out_path)}

        pin_tables = extract_pin_tables(file_path)
        pin_table = []
        if pin_tables:
            pkg = next(iter(pin_tables))
            pin_table = pin_tables[pkg]

        if not pin_table:
            return {"file": file_path.name, "status": "skipped", "reason": "no pin table"}

        # Get device name from identify function
        identification = identify_file(file_path)
        device_name = identification.get("device_name") or file_path.stem

        rules = (
            extract_rules_for_html(file_path, pin_table)
            if file_path.suffix.lower() in {'.html', '.htm'}
            else extract_rules_for_pdf(file_path, pin_table)
        )
        out = {
            device_name: {
                "filename": file_path.name,
                "pin": pin_table,
                "checklist": rules,
                "footnote": "",
            }
        }
        out_path = out_dir / f"{file_path.stem}.json"
        out_path.write_text(json.dumps(out, indent=2), encoding='utf-8')
        return {"file": file_path.name, "status": "ok", "out": str(out_path)}
    except Exception as exc:
        return {"file": file_path.name, "status": "error", "error": str(exc)}


def run_one_with_output_dir(args):
    """Wrapper function for ProcessPoolExecutor that unpacks file_path and output_dir"""
    file_path, output_dir = args
    return run_one(file_path, output_dir)


def main():
    parser = argparse.ArgumentParser(description="Run rules extraction over files in parallel.")
    parser.add_argument("targets", nargs="*", help="Optional explicit files to process")
    parser.add_argument("--src", default=".", help="Source directory to search for files (default: current directory)")
    parser.add_argument("--out", default="output", help="Output directory for generated files (default: output)")
    default_workers = max(1, (os.cpu_count() or 2) - 1)
    parser.add_argument(
        "--workers",
        "-w",
        type=int,
        default=default_workers,
        help=f"Number of parallel workers (default: {default_workers})",
    )
    args = parser.parse_args()

    # Set output directory from args
    output_dir = Path(args.out)
    
    src = Path(args.src)
    output_dir.mkdir(parents=True, exist_ok=True)
    files = [Path(t) for t in args.targets] if args.targets else list(src.glob('*.html')) + list(src.glob('*.htm')) + list(src.glob('*.pdf'))

    results: List[Dict[str, str]] = []
    if not files:
        print(json.dumps({"done": True, "out": str(output_dir), "count": 0, "ok": 0, "skipped": 0, "errors": 0}))
        return

    # Prepare arguments for ProcessPoolExecutor: (file_path, output_dir) tuples
    file_args = [(file_path, output_dir) for file_path in files]
    
    with ProcessPoolExecutor(max_workers=args.workers) as executor:
        for res in executor.map(run_one_with_output_dir, file_args):
            results.append(res)

    ok = sum(1 for r in results if r.get("status") == "ok")
    skipped = sum(1 for r in results if r.get("status") == "skipped")
    errors = [r for r in results if r.get("status") == "error"]

    summary = {
        "done": True,
        "out": str(output_dir),
        "count": len(files),
        "ok": ok,
        "skipped": skipped,
        "errors": len(errors),
        "results": results,
    }
    print(json.dumps(summary))

if __name__ == '__main__':
    main()
