# Generación de ofertas por proveedor

Los scripts leen el CSV de productos y una lista de precios en PDF o XLSX, y generan un CSV compatible con la importación de `supplier_offers`.

Cada proveedor tiene un script con rutas y datos por defecto:

```bash
python3 scripts/supplier_offers/generate_kf.py
python3 scripts/supplier_offers/generate_pecas.py
python3 scripts/supplier_offers/generate_mona.py
python3 scripts/supplier_offers/generate_senor_gonzalez.py
```

También se puede reemplazar la fuente y el destino mediante argumentos. Ejemplo:

```bash
python3 scripts/supplier_offers/generate_kf.py \
  --source "/ruta/LISTA MAYORISTA ACTUALIZADA.xlsx" \
  --output exports/supplier-offers-kf.csv \
  --supplier-id eb83d63e-e1c6-4f0c-8f92-d1d57ad10048 \
  --supplier-name "Distribuidora KF"
```

Para otro proveedor se cambia `--source`, `--output`, `--supplier-id` y `--supplier-name`. El script exige marca y presentación compatibles; las coincidencias ambiguas se excluyen y se informan en consola.

Dependencias: `pdfplumber` para PDF y `openpyxl` para XLSX.
