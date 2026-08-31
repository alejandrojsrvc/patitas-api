#!/usr/bin/env python3
from pathlib import Path
from generate_offers import main
if __name__ == '__main__':
    main({'source': Path('/Users/alejandrojesussojoruiz/Downloads/LISTA MAYORISTA ACTUALIZADA 27-08-26.xlsx'), 'output': Path('exports/supplier-offers-kf.csv'), 'supplier_id': 'eb83d63e-e1c6-4f0c-8f92-d1d57ad10048', 'supplier_name': 'Distribuidora KF'})
