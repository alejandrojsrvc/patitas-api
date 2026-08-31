#!/usr/bin/env python3
"""Generate supplier-offer imports from a supplier PDF or XLSX price list."""
from __future__ import annotations

import argparse
import csv
import re
import unicodedata
from pathlib import Path
from difflib import SequenceMatcher

OUTPUT_FIELDS = [
    'supplier_id', 'supplier_name', 'variant_id', 'sku', 'barcode', 'ean',
    'supplier_sku', 'unit_cost', 'stock_status', 'lead_time_hours',
    'minimum_quantity', 'active',
]
STOP_WORDS = {'alimento', 'para', 'de', 'la', 'el', 'y', 'x', 'kg'}


def normalize(value: object) -> str:
    value = unicodedata.normalize('NFKD', str(value or '')).encode('ascii', 'ignore').decode().lower()
    value = re.sub(r'[^a-z0-9]+', ' ', value)
    return ' '.join(value.split())


def grams(value: object) -> int | None:
    match = re.search(r'(\d+(?:[.,]\d+)?)\s*(kg|k|g|l|lt|lts|litros?)', str(value or '').lower())
    if not match:
        return None
    amount = float(match.group(1).replace(',', '.'))
    unit = match.group(2)
    return round(amount * (1000 if unit in {'kg', 'k', 'l', 'lt', 'lts', 'litros'} else 1))


def money(value: object) -> float | None:
    text = str(value or '').strip().replace('$', '').replace(' ', '')
    if not text:
        return None
    # Supplier lists use dots as thousands separators and commas as decimals.
    text = text.replace('.', '').replace(',', '.')
    try:
        number = float(text)
    except ValueError:
        return None
    return number if number > 0 else None


def pdf_records(path: Path) -> list[tuple[str, float]]:
    import pdfplumber
    records = []
    price_pattern = re.compile(r'\$\s*([\d\s.,]+)$')
    context = ''
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ''
            for line in text.splitlines():
                line = line.strip()
                if line and not re.search(r'\d', line) and line.upper() == line and len(line) > 3:
                    context = line
                matches = list(price_pattern.finditer(line))
                if not matches:
                    continue
                match = matches[-1]
                price = money(match.group(1))
                label = line[:match.start()].strip(' -:$')
                if price and label:
                    records.append((f'{context} {label}', price))
    return records


def xlsx_records(path: Path) -> list[tuple[str, float]]:
    import openpyxl
    records = []
    workbook = openpyxl.load_workbook(path, data_only=True, read_only=True)
    for sheet in workbook.worksheets:
        for row in sheet.iter_rows(values_only=True):
            label = row[0] if row else None
            price = row[1] if len(row) > 1 else None
            parsed = money(price)
            if isinstance(label, str) and parsed:
                records.append((label.strip(), parsed))
    return records


def tokens(value: str) -> set[str]:
    return {word for word in normalize(value).split() if word not in STOP_WORDS and not word.isdigit()}


def score(product: dict[str, str], label: str) -> float:
    product_text = ' '.join([
        product['brand_name'], product['name'], product['line'], product['life_stage'],
        product['breed_size'], product['presentation'],
    ])
    product_tokens = tokens(product_text)
    label_tokens = tokens(label)
    overlap = len(product_tokens & label_tokens) / max(1, len(product_tokens))
    sequence = SequenceMatcher(None, normalize(product_text), normalize(label)).ratio()
    return overlap * 0.75 + sequence * 0.25


def match_products(products: list[dict[str, str]], records: list[tuple[str, float]]) -> tuple[dict[str, float], list[str]]:
    matched: dict[str, float] = {}
    excluded: list[str] = []
    for product in products:
        expected_weight = grams(product['presentation'])
        candidates = []
        for label, price in records:
            if expected_weight is not None and grams(label) != expected_weight:
                continue
            candidates.append((score(product, label), label, price))
        candidates.sort(reverse=True)
        if not candidates or candidates[0][0] < 0.42 or (len(candidates) > 1 and candidates[0][0] - candidates[1][0] < 0.035):
            excluded.append(product['sku'])
            continue
        matched[product['sku']] = candidates[0][2]
    return matched, excluded


def main(defaults: dict[str, object] | None = None) -> None:
    defaults = defaults or {}
    parser = argparse.ArgumentParser()
    parser.add_argument('--products', type=Path, default=defaults.get('products', Path('/Users/alejandrojesussojoruiz/Downloads/products (2).csv')))
    parser.add_argument('--source', type=Path, default=defaults.get('source'))
    parser.add_argument('--output', type=Path, default=defaults.get('output'))
    parser.add_argument('--supplier-id', default=defaults.get('supplier_id'))
    parser.add_argument('--supplier-name', default=defaults.get('supplier_name'))
    args = parser.parse_args()
    if not all((args.source, args.output, args.supplier_id, args.supplier_name)):
        parser.error('--source, --output, --supplier-id y --supplier-name son obligatorios')

    products = list(csv.DictReader(args.products.open(encoding='utf-8-sig')))
    records = xlsx_records(args.source) if args.source.suffix.lower() in {'.xlsx', '.xlsm'} else pdf_records(args.source)
    prices, excluded = match_products(products, records)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=OUTPUT_FIELDS)
        writer.writeheader()
        for product in sorted((p for p in products if p['sku'] in prices), key=lambda p: p['sku']):
            writer.writerow({
                'supplier_id': args.supplier_id, 'supplier_name': args.supplier_name,
                'variant_id': product['variant_id'], 'sku': product['sku'],
                'barcode': product['barcode'], 'ean': '', 'supplier_sku': '',
                'unit_cost': f'{prices[product["sku"]]:.2f}', 'stock_status': 'UNKNOWN',
                'lead_time_hours': '', 'minimum_quantity': '1', 'active': 'true',
            })
    print(f'{args.supplier_name}: {len(prices)} coincidencias, {len(excluded)} excluidos')
    if excluded:
        print('Excluidos:', ', '.join(excluded))


if __name__ == '__main__':
    main()
