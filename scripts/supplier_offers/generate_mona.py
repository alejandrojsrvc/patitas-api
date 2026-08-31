#!/usr/bin/env python3
from pathlib import Path
from generate_offers import main
if __name__ == '__main__':
    main({'source': Path('/Users/alejandrojesussojoruiz/Downloads/LISTA  DISTRIBUIDORA MONA PET SHOP 10.08.2026.pdf'), 'output': Path('exports/supplier-offers-mona.csv'), 'supplier_id': 'f0d8875a-e0dc-4329-a0ef-1cd6dec7b236', 'supplier_name': 'Distribuidora Mona Pet Shop'})
