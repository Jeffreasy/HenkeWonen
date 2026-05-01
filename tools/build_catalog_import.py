from __future__ import annotations

import hashlib
import json
import math
import os
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

sys.path.append(str(Path(__file__).resolve().parent))

from audit_excel_data import (  # noqa: E402
    CODE_HEADER_RE,
    CONVERTED_DIR,
    DATA_DIR,
    ROOT,
    clean_text,
    detect_header_row,
    infer_price_type,
    infer_unit,
    infer_vat_mode,
    is_price_header,
    is_quantity_header,
    row_kind,
    safe_sample,
    sheet_rows,
)


OUT_DIR = ROOT / "docs"
SUMMARY_OUT = OUT_DIR / "catalog-import-summary.md"
SUMMARY_JSON_OUT = OUT_DIR / "catalog-import-summary.json"
SAMPLE_OUT = OUT_DIR / "catalog-import-sample.md"
GENERATED_DIR = OUT_DIR / "generated"
FULL_ROWS_OUT = GENERATED_DIR / "catalog-import-preview.full.jsonl"

MAX_ROWS_PER_SHEET = 50000

DISPLAY_CATEGORIES = {
    "pvc-vloeren": "PVC Vloeren",
    "pvc-click": "PVC Click",
    "pvc-dryback": "PVC Dryback",
    "palletcollectie-pvc": "Palletcollectie PVC",
    "traprenovatie": "Traprenovatie",
    "tapijt": "Tapijt",
    "vinyl": "Vinyl",
    "gordijnen": "Gordijnen",
    "raambekleding": "Raambekleding",
    "wandpanelen": "Wandpanelen",
    "douchepanelen": "Douchepanelen",
    "tegels": "Tegels",
    "entreematten": "Entreematten",
    "plinten": "Plinten",
    "lijm": "Lijm",
    "kit": "Kit",
    "egaline": "Egaline",
    "ondervloer": "Ondervloer",
    "behang": "Behang",
    "roedes-railsen": "Roedes/Railsen",
    "karpetten": "Karpetten",
    "horren": "Horren",
    "overig": "Overig",
}

ATTRIBUTE_HEADERS = {
    "breedte",
    "width",
    "afmeting",
    "afmetingen",
    "kamerhoog",
    "lining",
    "pattern length",
    "weight",
    "roman blinds",
    "pattern width",
    "material style",
    "washing symbols",
    "composition",
    "suitable for panel curtains",
    "full length curtains",
    "mart visser",
    "type",
    "rug",
    "projectgeschikt",
    "warmtedoorlating",
    "poolmateriaal",
    "soort backing",
    "garantie woongebruik",
    "materiaal latten",
    "materiaal backing",
    "vochtwerend",
    "click system",
    "eir",
    "class",
    "bevels",
    "bevel name",
    "structuur",
    "klasse",
    "klasse (wonen)",
    "klasse (project)",
    "klasse (industrieel)",
    "garantie wonen (jaren)",
    "garantie woongebruik",
    "garantie project (jaren)",
    "micro bevel 4v",
    "v-groef",
    "unieke planken per decor",
    "unieke planken per décor",
    "wateropname p/m2",
    "totaal gewicht in g/m2",
    "totaal hoogte in mm",
    "hoogte (mm)",
    "kg",
    "verpakking",
    "inhoud",
    "aantal kleuren",
}


def normalize(value: str) -> str:
    text = value.lower().strip()
    text = text.replace("€", "eur").replace("²", "2").replace("¹", "1")
    text = re.sub(r"\s+", " ", text)
    return text


def key(value: str) -> str:
    text = normalize(value)
    text = re.sub(r"[^a-z0-9]+", "", text)
    return text


def attribute_key(value: str) -> str:
    text = normalize(value)
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = text.strip("_")
    return text or "attribute"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stable_hash(parts: list[Any]) -> str:
    joined = "|".join(clean_text(part) for part in parts if clean_text(part))
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()[:24]


def raw_row(headers: list[str], values: list[Any]) -> dict[str, Any]:
    raw: dict[str, Any] = {}
    for index, value in enumerate(values):
        header = headers[index] if index < len(headers) and headers[index] else f"column_{index + 1}"
        sample = safe_sample(value)
        if sample:
            raw[header] = sample
    return raw


def preview_row(
    source_path: Path,
    analysis_path: Path,
    sheet_name: str,
    row_number: int,
    row_kind_value: str,
    headers: list[str],
    values: list[Any],
    section_label: str | None = None,
    normalized: dict[str, Any] | None = None,
    warnings: list[str] | None = None,
    errors: list[str] | None = None,
) -> dict[str, Any]:
    row_raw = raw_row(headers, values)
    status = "valid"
    if row_kind_value in {"header", "section", "empty", "ignored"}:
        status = "ignored"
    elif errors:
        status = "error"
    elif warnings:
        status = "warning"

    return {
        "rowKind": row_kind_value,
        "status": status,
        "sourceFileName": source_path.name,
        "sourceSheetName": sheet_name,
        "rowNumber": row_number,
        "rowHash": stable_hash(
            [
                str(source_path.relative_to(ROOT)),
                sheet_name,
                row_number,
                json.dumps(row_raw, ensure_ascii=False, sort_keys=True),
            ]
        ),
        "raw": row_raw,
        "normalized": normalized,
        "sectionLabel": section_label,
        "warnings": warnings or [],
        "errors": errors or [],
        "analysisPath": str(analysis_path.relative_to(ROOT)),
    }


def converted_xlsx_for(path: Path) -> Path | None:
    if path.suffix.lower() != ".xls":
        return path
    candidate = CONVERTED_DIR / f"{path.stem}.xlsx"
    return candidate if candidate.exists() else None


def code_string(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return str(int(value)) if value.is_integer() else format(value, "f").rstrip("0").rstrip(".")
    text = clean_text(value)
    return text or None


def number_value(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        if isinstance(value, float) and math.isnan(value):
            return None
        return float(value)
    text = clean_text(value)
    if not text or text.upper() in {"#N/A", "N/A", "-"}:
        return None
    text = text.replace("€", "").replace("EUR", "").replace("eur", "")
    text = text.replace("\u00a0", " ").strip()
    text = re.sub(r"[^0-9,.\-]", "", text)
    if not text:
        return None
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return None


def intish(value: float | None) -> int | float | None:
    if value is None:
        return None
    return int(value) if value.is_integer() else value


def headers_for(ws) -> tuple[int | None, list[str]]:
    max_col = min(ws.max_column or 1, 80)
    header_row = detect_header_row(ws, 100, max_col)
    if not header_row:
        return None, []
    header_values = next(sheet_rows(ws, header_row, header_row, max_col), [])
    headers = [clean_text(value).replace("\n", " ") for value in header_values]
    while headers and not headers[-1]:
        headers.pop()
    return header_row, headers


def get_value(headers: list[str], values: list[Any], candidates: list[str]) -> Any:
    candidate_keys = {key(candidate) for candidate in candidates}
    for index, header in enumerate(headers):
        if index >= len(values):
            continue
        if key(header) in candidate_keys:
            return values[index]
    return None


def get_text(headers: list[str], values: list[Any], candidates: list[str]) -> str | None:
    return code_string(get_value(headers, values, candidates))


def has_text(*values: str | None) -> str | None:
    parts = [value for value in values if value]
    return " ".join(parts) if parts else None


def supplier_for(path: Path) -> str:
    name = path.name.lower()
    if "headlam" in name:
        return "Headlam"
    if "interfloor" in name:
        return "Interfloor"
    if "co-pro" in name:
        return "Co-pro"
    if "ambiant" in name:
        return "Ambiant"
    if "evc" in name:
        return "EVC"
    if "vtwonen" in name or "vt wonen" in name:
        return "vtwonen"
    if "roots" in name:
        return "Roots"
    return "Floorlife"


def category_slug_for(path: Path, sheet_name: str, section_label: str | None, product_name: str) -> str:
    source = f"{path.name} {sheet_name}".lower()
    text = f"{source} {section_label or ''} {product_name}".lower()
    if "lijm" in source and "kit" in source and "egaline" in source:
        product_text = product_name.lower()
        if any(
            token in product_text
            for token in ["lijm", "kleefstof", "kleefstoffen", "fixeer", "antislip", "parketlijm"]
        ):
            return "lijm"
        if any(token in product_text for token in ["kit", "siliconen", "silicone", "acrylaat", "afdicht"]):
            return "kit"
        if any(
            token in product_text
            for token in ["egal", "primer", "voorstrijk", "mortel", "kwartszand", "mengemmer", "maatemmer"]
        ):
            return "egaline"
        material_text = f"{section_label or ''} {product_name}".lower()
        if any(token in material_text for token in ["kit", "siliconen", "silicone", "acrylaat", "afdicht"]):
            return "kit"
        return "egaline"
    if "douchepanelen" in source and "tegels" in source:
        detail_text = f"{section_label or ''} {product_name}".lower()
        if "tegel" in detail_text:
            return "tegels"
        return "douchepanelen"
    if "karpet" in text:
        return "karpetten"
    if "vinyl" in source:
        return "vinyl"
    if "tapijt" in source or "interfloor" in source:
        return "tapijt"
    if "palletcollectie" in source:
        return "palletcollectie-pvc"
    if "pvc" in source or "evc" in source or "roots" in source:
        if "dryback" in sheet_name.lower() or "drbyack" in sheet_name.lower():
            return "pvc-dryback"
        if "src" in sheet_name.lower() or "click" in sheet_name.lower():
            return "pvc-click"
        return "pvc-vloeren"
    if "traprenovatie" in text or "trap" in text:
        return "traprenovatie"
    if "wandpanelen" in text or "wandpaneel" in text:
        return "wandpanelen"
    if "douche" in text:
        return "douchepanelen"
    if "tegel" in text:
        return "tegels"
    if "entreemat" in text or "entreematten" in text:
        return "entreematten"
    if "plint" in text:
        return "plinten"
    if "egal" in text:
        return "egaline"
    if "kit" in text:
        return "kit"
    if "lijm" in text or "adhesive" in text:
        return "lijm"
    if "gordijn" in text or "headlam" in text or "curtain" in text:
        return "gordijnen"
    return "overig"


def product_kind_for(category_slug: str, path: Path, sheet_name: str, product_name: str) -> str:
    source = f"{path.name} {sheet_name}".lower()
    text = f"{source} {product_name}".lower()
    if category_slug == "karpetten":
        return "rug"
    if "src" in sheet_name.lower():
        return "src"
    if "dryback" in sheet_name.lower() or "drbyack" in sheet_name.lower():
        return "dryback"
    if "click" in sheet_name.lower() or "click" in text:
        return "click"
    if category_slug == "tapijt":
        return "carpet"
    if category_slug == "vinyl":
        return "vinyl"
    if category_slug in {"wandpanelen", "douchepanelen"}:
        return "panel"
    if category_slug == "tegels":
        return "tile"
    if category_slug == "gordijnen":
        return "curtain_fabric"
    if category_slug == "entreematten":
        return "mat"
    if category_slug in {"lijm", "kit", "egaline"}:
        return "adhesive"
    if category_slug == "plinten":
        return "plinth"
    return "other"


def unit_for(category_slug: str, product_kind: str) -> str:
    if product_kind in {"curtain_fabric", "vitrage"}:
        return "m1"
    if category_slug in {"pvc-vloeren", "pvc-click", "pvc-dryback", "palletcollectie-pvc", "tapijt", "vinyl", "wandpanelen"}:
        return "m2"
    if category_slug in {"plinten", "roedes-railsen"}:
        return "meter"
    if category_slug == "traprenovatie":
        return "step"
    if category_slug in {"karpetten", "entreematten"}:
        return "piece"
    return "piece"


def product_type_for(product_kind: str) -> str:
    if product_kind in {"curtain", "fabric", "curtain_fabric", "vitrage", "roman_blind_fabric", "panel_curtain_fabric"}:
        return "made_to_measure"
    return "standard"


def commercial_names(headers: list[str], values: list[Any]) -> list[dict[str, str]]:
    names = []
    for brand, collection_header, color_header in [
        ("Ambiant", "Ambiant Collectie", "Ambiant Kleur"),
        ("Floorlife", "Floorlife Collectie", "Floorlife Kleur"),
    ]:
        collection = get_text(headers, values, [collection_header])
        color = get_text(headers, values, [color_header])
        display = has_text(brand, collection, color)
        if collection or color:
            item: dict[str, str] = {"brandName": brand, "displayName": display or brand}
            if collection:
                item["collectionName"] = collection
            if color:
                item["colorName"] = color
            names.append(item)
    return names


def product_name_for(headers: list[str], values: list[Any], path: Path, sheet_name: str) -> str | None:
    supplier = supplier_for(path)
    if "entreematten" in path.name.lower():
        return code_string(values[1]) if len(values) > 1 else None
    if supplier == "Headlam":
        return has_text(
            get_text(headers, values, ["Quality"]),
            get_text(headers, values, ["Design"]),
            get_text(headers, values, ["Type"]),
        )
    if supplier == "Roots":
        return has_text(
            get_text(headers, values, ["Material Description"]),
            get_text(headers, values, ["Decor name"]),
            get_text(headers, values, ["Commercial Code"]),
        )
    aliases = commercial_names(headers, values)
    if aliases:
        return aliases[-1]["displayName"]
    return has_text(
        get_text(headers, values, ["Kwaliteitsnaam"]),
        get_text(headers, values, ["Kwaliteit"]),
        get_text(headers, values, ["Omschrijving"]),
        get_text(headers, values, ["Material Description"]),
        get_text(headers, values, ["Decor name"]),
        get_text(headers, values, ["Afmeting (cm)"]),
        sheet_name if supplier == "Interfloor" else None,
    )


def set_dimension_fields(row: dict[str, Any], headers: list[str], values: list[Any]) -> None:
    width = number_value(get_value(headers, values, ["Breedte (cm)", "Breedte", "Breedte in cm", "Width", "W"]))
    length = number_value(get_value(headers, values, ["Lengte (cm)", "Lengte in cm", "Lengte plank (cm)", "Lengte mm", "Lengte", "Length", "L"]))
    thickness = number_value(get_value(headers, values, ["Dikte (mm)", "Totale dikte (mm)", "Totaal dikte (mm)", "Dikte mm", "Dikte in mm", "Dikte", "Tick"]))
    wear = number_value(get_value(headers, values, ["Dikte toplaag (mm)", "Toplaag in mm", "Toplaag (mm)", "Toplaag mm", "Toplaag"]))
    package_m2 = number_value(get_value(headers, values, ["Aantal m2 per pak", "Pakinhoud (m²)", "Pakinhoud", "m2"]))
    pieces = number_value(get_value(headers, values, ["Aantal panelen per pak", "Planken per pak", "Panels"]))
    packs = number_value(get_value(headers, values, ["Aantal pakken per pallet", "Aantal pakker per pallet", "Pakken per pallet", "Packs"]))

    if width is not None:
        row["widthMm"] = width * 10 if width < 1000 else width
    if length is not None:
        row["lengthMm"] = length * 10 if length < 1000 else length
    if thickness is not None:
        row["thicknessMm"] = thickness
    if wear is not None:
        row["wearLayerMm"] = wear
    if package_m2 is not None:
        row["packageContentM2"] = package_m2
    if pieces is not None:
        row["piecesPerPackage"] = intish(pieces)
    if packs is not None:
        row["packagesPerPallet"] = intish(packs)


def set_quantity_fields(row: dict[str, Any], headers: list[str], values: list[Any]) -> None:
    for index, header in enumerate(headers):
        if index >= len(values) or not is_quantity_header(header):
            continue
        number = number_value(values[index])
        lower = normalize(header)
        text = code_string(values[index])
        if "trailer" in lower and number is not None:
            row["trailerQuantity"] = intish(number)
        elif "pallet" in lower and number is not None:
            row["palletQuantity"] = intish(number)
        elif "bundel" in lower and number is not None:
            row["bundleSize"] = intish(number)
        elif "planken per pak" in lower and number is not None:
            row["piecesPerPackage"] = intish(number)
        elif "pakinhoud" in lower and number is not None:
            row["packageContentM2"] = number
        elif "besteleenheid" in lower or "afname" in lower:
            row["orderUnit"] = text
        elif "m2 per pak" in lower or "m² per pak" in lower:
            row["packageContentM2"] = number


def valid_from_for(path: Path, header: str | None = None) -> int | None:
    text = f"{path.name} {header or ''}".lower()
    match = re.search(r"(?:vanaf\s*)?(\d{1,2})[./-](\d{1,2})[./-](\d{4})", text)
    if not match:
        return None
    day, month, year = (int(part) for part in match.groups())
    try:
        from datetime import datetime, timezone

        return int(datetime(year, month, day, tzinfo=timezone.utc).timestamp() * 1000)
    except ValueError:
        return None


def year_for(path: Path) -> int | None:
    years = [int(value) for value in re.findall(r"20\d{2}", path.name)]
    return max(years) if years else None


def attributes_for(headers: list[str], values: list[Any]) -> dict[str, Any] | None:
    attributes: dict[str, Any] = {}
    for index, header in enumerate(headers):
        if index >= len(values) or not header:
            continue
        if is_price_header(header) or is_quantity_header(header) or CODE_HEADER_RE.search(header):
            continue
        normalized = normalize(header)
        if normalized in ATTRIBUTE_HEADERS or any(token in normalized for token in ATTRIBUTE_HEADERS):
            value = code_string(values[index])
            if value:
                attributes[attribute_key(header)] = value
    return attributes or None


def price_unit_for(header: str, category_slug: str) -> str:
    unit = infer_unit(header)
    if unit != "custom":
        return unit
    lower = normalize(header)
    if "adviesverkoopprijs vanaf" in lower:
        return "pack"
    if category_slug == "gordijnen" and "consumer" in lower:
        return "m1"
    if category_slug in {"karpetten", "douchepanelen", "wandpanelen"}:
        return "piece"
    return unit


def prices_for(
    headers: list[str],
    values: list[Any],
    row: dict[str, Any],
    source_path: Path,
) -> list[dict[str, Any]]:
    prices = []
    for index, header in enumerate(headers):
        if index >= len(values) or not header or not is_price_header(header):
            continue
        amount = number_value(values[index])
        if amount is None or amount <= 0:
            continue
        price_type = infer_price_type(header)
        price_unit = price_unit_for(header, row["categorySlug"])
        source_key = stable_hash(
            [
                row["importKey"],
                row.get("fileHash") or row["sourcePath"],
                row["sourceSheetName"],
                row["sourceRowNumber"],
                index,
                header,
                price_type,
                price_unit,
            ]
        )
        prices.append(
            {
                "sourceKey": source_key,
                "priceType": price_type,
                "priceUnit": price_unit,
                "amount": round(amount, 4),
                "vatRate": 21,
                "vatMode": infer_vat_mode(header),
                "validFrom": valid_from_for(source_path, header) or row.get("validFrom"),
                "currency": "EUR",
                "sourceColumnName": header,
                "sourceColumnIndex": index,
                "sourceValue": safe_sample(values[index]),
            }
        )
    return prices


def build_row(
    source_path: Path,
    analysis_path: Path,
    sheet_name: str,
    headers: list[str],
    values: list[Any],
    row_number: int,
    section_label: str | None,
    file_hash: str,
) -> dict[str, Any] | None:
    product_name = product_name_for(headers, values, source_path, sheet_name)
    if not product_name:
        return None

    supplier_name = supplier_for(source_path)
    category_slug = category_slug_for(source_path, sheet_name, section_label, product_name)
    category_name = DISPLAY_CATEGORIES.get(category_slug, "Overig")
    product_kind = product_kind_for(category_slug, source_path, sheet_name, product_name)
    aliases = commercial_names(headers, values)
    article_number = get_text(headers, values, ["Artikelnummer", "Art.nr."])
    if "entreematten" in source_path.name.lower() and not article_number:
        article_number = code_string(values[0]) if values else None
    supplier_code = get_text(headers, values, ["Supplier Code", "SAP codes floors"])
    commercial_code = get_text(headers, values, ["Commercial Code"])
    ean = get_text(headers, values, ["EAN", "EAN code", "EAN-code", "EAN Code"])
    color = get_text(headers, values, ["Kleur", "Kleurindicatie", "Kleurnummer", "Design", "Decor name"])
    supplier_group = get_text(headers, values, ["Artikelgroep", "Soort"])
    if "entreematten" in source_path.name.lower():
        collection_name = section_label
    else:
        collection_name = (
            get_text(headers, values, ["Quality"])
            or get_text(headers, values, ["Kwaliteit"])
            or get_text(headers, values, ["Material Description"])
            or section_label
        )
    brand_name = get_text(headers, values, ["Company"]) or supplier_name
    source_rel = str(source_path.relative_to(ROOT))
    import_identity = article_number or supplier_code or commercial_code or ean or product_name
    import_key = stable_hash([supplier_name, category_name, import_identity])

    row: dict[str, Any] = {
        "importKey": import_key,
        "sourceFileName": source_path.name,
        "sourceSheetName": sheet_name,
        "sourcePath": source_rel,
        "analysisPath": str(analysis_path.relative_to(ROOT)),
        "fileHash": file_hash,
        "sourceRowNumber": row_number,
        "year": year_for(source_path),
        "validFrom": valid_from_for(source_path),
        "supplierName": supplier_name,
        "brandName": brand_name,
        "collectionName": collection_name,
        "sectionLabel": section_label,
        "categorySlug": category_slug,
        "categoryName": category_name,
        "productName": product_name,
        "colorName": color,
        "articleNumber": article_number,
        "supplierCode": supplier_code,
        "commercialCode": commercial_code,
        "supplierProductGroup": supplier_group,
        "ean": ean,
        "productKind": product_kind,
        "productType": product_type_for(product_kind),
        "commercialNames": aliases or None,
        "unit": unit_for(category_slug, product_kind),
    }
    set_dimension_fields(row, headers, values)
    set_quantity_fields(row, headers, values)
    attrs = attributes_for(headers, values)
    if attrs:
        row["attributes"] = attrs
    row["prices"] = prices_for(headers, values, row, source_path)
    return {key_: value for key_, value in row.items() if value is not None}


def zero_or_no_price_warning(warnings: list[str]) -> bool:
    return any("zonder bruikbare prijs" in warning.lower() for warning in warnings)


ROW_KIND_LABELS = {
    "header": "Kopregel",
    "section": "Sectieregel",
    "product": "Productregel",
    "empty": "Lege regel",
    "warning": "Waarschuwing",
    "error": "Fout",
    "ignored": "Genegeerde regel",
}

STATUS_LABELS = {
    "valid": "Geldig",
    "warning": "Waarschuwing",
    "error": "Fout",
    "ignored": "Genegeerd",
    "imported": "Geïmporteerd",
}


def label_row_kind(value: str) -> str:
    return ROW_KIND_LABELS.get(value, value)


def label_status(value: str) -> str:
    return STATUS_LABELS.get(value, value)


def parse_workbook(source_path: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    analysis_path = converted_xlsx_for(source_path)
    if analysis_path is None:
        return [], [], [f"{source_path.name}: legacy .xls is not converted in .audit-cache"]

    file_hash = sha256(source_path)
    rows: list[dict[str, Any]] = []
    preview_rows: list[dict[str, Any]] = []
    warnings: list[str] = []
    workbook = load_workbook(analysis_path, read_only=True, data_only=True)
    try:
        for sheet_name in workbook.sheetnames:
            ws = workbook[sheet_name]
            header_row, headers = headers_for(ws)
            if not header_row or not headers:
                continue
            max_col = len(headers)
            preview_rows.append(
                preview_row(
                    source_path,
                    analysis_path,
                    sheet_name,
                    header_row,
                    "header",
                    headers,
                    headers,
                )
            )
            code_indexes = [
                index for index, header in enumerate(headers) if CODE_HEADER_RE.search(header)
            ]
            price_indexes = [
                index for index, header in enumerate(headers) if is_price_header(header)
            ]
            section_label: str | None = None
            empty_streak = 0
            start = header_row + 1
            max_row = min(ws.max_row or 0, MAX_ROWS_PER_SHEET)
            for row_number, row_values in enumerate(
                sheet_rows(ws, start, max_row, max_col),
                start=start,
            ):
                values = list(row_values)
                kind = row_kind(values, code_indexes, price_indexes)
                if kind == "empty":
                    empty_streak += 1
                    preview_rows.append(
                        preview_row(
                            source_path,
                            analysis_path,
                            sheet_name,
                            row_number,
                            "empty",
                            headers,
                            values,
                            section_label,
                        )
                    )
                    if row_number > start + 100 and empty_streak >= 500:
                        break
                    continue
                empty_streak = 0
                if kind == "section":
                    section_label = clean_text(next((value for value in values if clean_text(value)), ""))
                    preview_rows.append(
                        preview_row(
                            source_path,
                            analysis_path,
                            sheet_name,
                            row_number,
                            "section",
                            headers,
                            values,
                            section_label,
                        )
                    )
                    continue
                normalized = build_row(
                    source_path,
                    analysis_path,
                    sheet_name,
                    headers,
                    values,
                    row_number,
                    section_label,
                    file_hash,
                )
                if normalized:
                    has_identity = any(
                        normalized.get(field)
                        for field in ["articleNumber", "supplierCode", "commercialCode", "ean"]
                    )
                    if not normalized.get("prices"):
                        if not has_identity:
                            section_label = normalized["productName"]
                            preview_rows.append(
                                preview_row(
                                    source_path,
                                    analysis_path,
                                    sheet_name,
                                    row_number,
                                    "section",
                                    headers,
                                    values,
                                    section_label,
                                    normalized,
                                )
                            )
                        else:
                            preview_rows.append(
                                preview_row(
                                    source_path,
                                    analysis_path,
                                    sheet_name,
                                    row_number,
                                    "ignored",
                                    headers,
                                    values,
                                    section_label,
                                    normalized,
                                    ["Productregel zonder bruikbare prijs is overgeslagen."],
                                )
                            )
                        continue
                    row_warnings = []
                    if any(price.get("vatMode") == "unknown" for price in normalized.get("prices", [])):
                        row_warnings.append("Btw-modus onbekend voor een of meer prijskolommen.")
                    if not has_identity:
                        row_warnings.append("Product gebruikt fallback-identiteit zonder artikelnummer/EAN/supplierCode.")
                    preview_rows.append(
                        preview_row(
                            source_path,
                            analysis_path,
                            sheet_name,
                            row_number,
                            "product",
                            headers,
                            values,
                            section_label,
                            normalized,
                            row_warnings,
                        )
                    )
                    rows.append(normalized)
                else:
                    preview_rows.append(
                        preview_row(
                            source_path,
                            analysis_path,
                            sheet_name,
                            row_number,
                            "ignored",
                            headers,
                            values,
                            section_label,
                            None,
                            ["Rij kon niet naar een productregel worden genormaliseerd."],
                        )
                    )
    finally:
        workbook.close()
    return rows, preview_rows, warnings


def summarize(
    rows: list[dict[str, Any]],
    preview_rows: list[dict[str, Any]],
    warnings: list[str],
    source_file_count: int,
) -> dict[str, Any]:
    by_file = Counter(row["sourceFileName"] for row in rows)
    by_category = Counter(row["categoryName"] for row in rows)
    price_count = sum(len(row.get("prices", [])) for row in rows)
    unknown_vat = sum(
        1
        for row in rows
        for price in row.get("prices", [])
        if price.get("vatMode") == "unknown"
    )
    row_kind_counts = Counter(row.get("rowKind", "unknown") for row in preview_rows)
    status_counts = Counter(row.get("status", "unknown") for row in preview_rows)
    zero_or_no_price_rows = sum(
        1 for row in preview_rows if zero_or_no_price_warning(row.get("warnings", []))
    )
    warning_rows = sum(1 for row in preview_rows if row.get("warnings"))
    error_rows = sum(1 for row in preview_rows if row.get("errors"))
    unknown_vat_rows = sum(
        1
        for row in preview_rows
        if any("btw-modus onbekend" in warning.lower() for warning in row.get("warnings", []))
    )

    return {
        "tenantSlug": "henke-wonen",
        "productRows": len(rows),
        "previewRows": len(preview_rows),
        "priceRules": price_count,
        "unknownVatModePriceRules": unknown_vat,
        "unknownVatModeRows": unknown_vat_rows,
        "sourceFiles": {
            "count": source_file_count,
            "withProductRows": len(by_file),
        },
        "categories": dict(by_category.most_common()),
        "sourceFileName": dict(by_file.most_common()),
        "rowKinds": dict(row_kind_counts.most_common()),
        "statuses": dict(status_counts.most_common()),
        "warnings": {
            "count": warning_rows,
            "errors": error_rows,
            "duplicateOrSkippedExactCopies": warnings,
            "zeroOrNoPriceRows": zero_or_no_price_rows,
        },
        "vatMapping": {
            "unresolvedVatMappings": None,
            "note": "Ontbrekende btw-mappings komen uit Convex importprofielen en worden in de portal bewaakt.",
        },
    }


def build_markdown(summary: dict[str, Any]) -> str:
    lines = [
        "# Catalogusimport samenvatting",
        "",
        "`docs/catalog-import-summary.md` is de primaire reviewbron voor de catalogusvoorvertoning.",
        "De grote rij-preview wordt standaard niet gegenereerd. Gebruik `npm run catalog:preview -- --full` of `CATALOG_PREVIEW_FULL=1` alleen voor debug/ontwikkeling.",
        "",
        "## Samenvatting",
        "",
        f"- Productregels: {summary['productRows']}",
        f"- Voorvertonings-/auditregels: {summary['previewRows']}",
        f"- Prijsregels: {summary['priceRules']}",
        f"- Prijsregels met onbekende btw-modus: {summary['unknownVatModePriceRules']}",
        f"- Rijen met waarschuwing over onbekende btw-modus: {summary['unknownVatModeRows']}",
        f"- Bronbestanden totaal: {summary['sourceFiles']['count']}",
        f"- Bronbestanden met productregels: {summary['sourceFiles']['withProductRows']}",
        f"- Rijen zonder bruikbare prijs: {summary['warnings']['zeroOrNoPriceRows']}",
        f"- Ontbrekende btw-mappings: {summary['vatMapping']['unresolvedVatMappings'] if summary['vatMapping']['unresolvedVatMappings'] is not None else 'niet beschikbaar in lokale Excel-voorvertoning'}",
        "",
        "## Per categorie",
        "",
        "| Categorie | Rijen |",
        "| --- | ---: |",
    ]
    for name, count in summary["categories"].items():
        lines.append(f"| {name} | {count} |")
    lines.extend(["", "## Per bronbestand", "", "| Bestand | Productregels |", "| --- | ---: |"])
    for name, count in summary["sourceFileName"].items():
        lines.append(f"| `{name}` | {count} |")
    lines.extend(["", "## Regeltypes", "", "| Regeltype | Rijen |", "| --- | ---: |"])
    for name, count in summary["rowKinds"].items():
        lines.append(f"| {label_row_kind(name)} | {count} |")
    lines.extend(["", "## Statussen", "", "| Status | Rijen |", "| --- | ---: |"])
    for name, count in summary["statuses"].items():
        lines.append(f"| {label_status(name)} | {count} |")
    if summary["warnings"]["duplicateOrSkippedExactCopies"]:
        lines.extend(["", "## Dubbele/overgeslagen exacte kopieën", ""])
        for warning in summary["warnings"]["duplicateOrSkippedExactCopies"]:
            lines.append(f"- {warning}")
    lines.extend(
        [
            "",
            "## Volledige preview",
            "",
            "- Standaard wordt geen rij-previewbestand geschreven.",
            f"- Debugpad: `{FULL_ROWS_OUT.relative_to(ROOT)}`",
            "- Volledige output is JSONL: één auditbare JSON-regel per voorvertoningsregel.",
        ]
    )
    lines.append("")
    return "\n".join(lines)


def build_sample(rows: list[dict[str, Any]], preview_rows: list[dict[str, Any]]) -> str:
    warning_error_rows = [
        row for row in preview_rows if row.get("warnings") or row.get("errors")
    ][:25]
    unknown_vat_rows = [
        row
        for row in preview_rows
        if any("btw-modus onbekend" in warning.lower() for warning in row.get("warnings", []))
    ][:25]
    lines = [
        "# Catalogusimport voorbeeld",
        "",
        "Compact voorbeeldbestand voor snelle menselijke controle. Maximaal 25 regels per sectie.",
        "",
        "## Eerste 25 productregels",
        "",
        "| Bestand | Tabblad | Rij | Product | Categorie | Prijsregels |",
        "| --- | --- | ---: | --- | --- | ---: |",
    ]
    for row in rows[:25]:
        product = str(row.get("productName", "")).replace("|", "\\|")
        lines.append(
            f"| `{row.get('sourceFileName')}` | `{row.get('sourceSheetName')}` | {row.get('sourceRowNumber')} | {product} | {row.get('categoryName')} | {len(row.get('prices', []))} |"
        )
    lines.extend(
        [
            "",
            "## Eerste 25 waarschuwings-/foutregels",
            "",
            "| Bestand | Tabblad | Rij | Regeltype | Status | Meldingen |",
            "| --- | --- | ---: | --- | --- | --- |",
        ]
    )
    for row in warning_error_rows:
        messages = "; ".join(row.get("warnings", []) + row.get("errors", [])).replace("|", "\\|")
        lines.append(
            f"| `{row.get('sourceFileName')}` | `{row.get('sourceSheetName')}` | {row.get('rowNumber')} | {label_row_kind(row.get('rowKind'))} | {label_status(row.get('status'))} | {messages} |"
        )
    lines.extend(
        [
            "",
            "## Eerste 25 regels met onbekende btw-modus",
            "",
            "| Bestand | Tabblad | Rij | Product | Meldingen |",
            "| --- | --- | ---: | --- | --- |",
        ]
    )
    for row in unknown_vat_rows:
        normalized = row.get("normalized") or {}
        product = str(normalized.get("productName", "")).replace("|", "\\|")
        messages = "; ".join(row.get("warnings", [])).replace("|", "\\|")
        lines.append(
            f"| `{row.get('sourceFileName')}` | `{row.get('sourceSheetName')}` | {row.get('rowNumber')} | {product} | {messages} |"
        )
    lines.append("")
    return "\n".join(lines)


def write_full_preview(rows: list[dict[str, Any]], preview_rows: list[dict[str, Any]]) -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    with FULL_ROWS_OUT.open("w", encoding="utf-8") as handle:
        for row in preview_rows:
            handle.write(
                json.dumps(
                    {"type": "previewRow", "tenantSlug": "henke-wonen", **row},
                    ensure_ascii=False,
                    sort_keys=True,
                )
                + "\n"
            )
        for row in rows:
            handle.write(
                json.dumps(
                    {"type": "productRow", "tenantSlug": "henke-wonen", **row},
                    ensure_ascii=False,
                    sort_keys=True,
                )
                + "\n"
            )


def main() -> None:
    OUT_DIR.mkdir(exist_ok=True)
    full_preview = "--full" in sys.argv[1:] or os.environ.get("CATALOG_PREVIEW_FULL") == "1"
    source_files = sorted(
        path
        for path in DATA_DIR.rglob("*")
        if path.is_file()
        and path.suffix.lower() in {".xlsx", ".xls"}
        and path.name != "Henke Wonen Jeffrey.xlsx"
    )
    rows: list[dict[str, Any]] = []
    preview_rows: list[dict[str, Any]] = []
    warnings: list[str] = []
    seen_hashes: dict[str, Path] = {}
    for source_path in source_files:
        file_hash = sha256(source_path)
        if file_hash in seen_hashes:
            warnings.append(
                f"{source_path.relative_to(ROOT)} is een exacte kopie van {seen_hashes[file_hash].relative_to(ROOT)} en is overgeslagen."
            )
            continue
        seen_hashes[file_hash] = source_path
        parsed_rows, parsed_preview_rows, parsed_warnings = parse_workbook(source_path)
        rows.extend(parsed_rows)
        preview_rows.extend(parsed_preview_rows)
        warnings.extend(parsed_warnings)

    summary = summarize(rows, preview_rows, warnings, len(source_files))
    SUMMARY_JSON_OUT.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    SUMMARY_OUT.write_text(build_markdown(summary), encoding="utf-8")
    SAMPLE_OUT.write_text(build_sample(rows, preview_rows), encoding="utf-8")
    if full_preview:
        write_full_preview(rows, preview_rows)
    print(
        json.dumps(
            {
                "sourceFiles": summary["sourceFiles"]["count"],
                "rows": summary["productRows"],
                "previewRows": summary["previewRows"],
                "prices": summary["priceRules"],
                "unknownVatModePriceRules": summary["unknownVatModePriceRules"],
                "categories": summary["categories"],
                "warnings": warnings[:20],
                "summary": str(SUMMARY_OUT.relative_to(ROOT)),
                "summaryJson": str(SUMMARY_JSON_OUT.relative_to(ROOT)),
                "sample": str(SAMPLE_OUT.relative_to(ROOT)),
                "fullPreview": str(FULL_ROWS_OUT.relative_to(ROOT)) if full_preview else None,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
