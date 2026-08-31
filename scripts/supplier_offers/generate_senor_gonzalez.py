#!/usr/bin/env python3
from pathlib import Path
from generate_offers import main
if __name__ == '__main__':
    main({'source': Path('/Users/alejandrojesussojoruiz/Downloads/Lista de Precios - 22 AGOSTO - copia.pdf'), 'output': Path('exports/supplier-offers-senor-gonzalez.csv'), 'supplier_id': '8357d7a1-e03f-42cc-ab8d-0cbf97226e6f', 'supplier_name': 'Distrubuidora Señor Gonzalez'})
