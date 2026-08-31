#!/usr/bin/env python3
from pathlib import Path
from generate_offers import main
if __name__ == '__main__':
    main({'source': Path('/Users/alejandrojesussojoruiz/Downloads/Lista Mayorista - Alimentos 21-08 (1).pdf'), 'output': Path('exports/supplier-offers-pecas.csv'), 'supplier_id': '6a5721f6-27d5-4d5a-9911-752a938d47cf', 'supplier_name': 'Distribuidora Pecas'})
