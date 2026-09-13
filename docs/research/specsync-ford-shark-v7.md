# BYD Shark evidence for the SpecSync v7 comparison

Research date: 2026-09-13. Scope: official BYD Brazil sources only. The demo identifies the vehicle as Shark GS 2025. No application code or comparison dataset was changed during this research.

## Recommended comparison values

| Field               | Display value                        | Evidence and scope                                                                                                                                                                                            |
| ------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Powertrain          | 1.5 L turbo + electric motors        | Brazilian launch article, 2024-10-25, introductory paragraph; June 2025 technical sheet, PDF p. 3, distinguishes the two electric motors from the combustion engine.                                          |
| Power               | 437 cv, combined                     | June 2025 sheet, PDF pp. 1 and 3. This is the manufacturer's system rating, not an arithmetic sum.                                                                                                            |
| Transmission/system | EHS, hybrid                          | Official product page, DMO section: “sistema híbrido elétrico longitudinal (EHS)”. EHS is the confirmed system description; DHT terminology and a numerical gear count were not established by these sources. |
| Drive               | Integral / AWD                       | June 2025 sheet, PDF p. 3; product page describes electrically controlled four-wheel drive.                                                                                                                   |
| Torque              | Approximately 637 N·m, combined      | Derived from **65 kgf·m combined**, stated in the 2024-10-25 Brazilian launch article, paragraph immediately before its connectivity subsection. See conversion below.                                        |
| Wheelbase           | 3,260 mm                             | June 2025 sheet, PDF p. 2, basic parameters table.                                                                                                                                                            |
| Wading depth        | 700 mm, subject to manual conditions | Shark-specific owner's manual, PDF p. 121, printed p. 4-42; conditions continue on PDF p. 122, printed p. 4-43.                                                                                               |

### Torque normalization

Preserve the original measurement separately:

```json
{
  "originalValue": 65,
  "sourceUnit": "kgf.m",
  "scope": "combined system",
  "conversionFactor": 9.80665,
  "normalizedUnit": "N.m",
  "normalizedValue": 637.43225,
  "displayValue": "≈637 N·m",
  "derivation": "65 × 9.80665"
}
```

The N·m figure is a unit conversion performed for the comparison, not a second BYD-published rating. Keep “combined” visible for Shark power and torque. Do not add the individual motor ratings together or substitute the later 650 N·m figure.

## Additional verified details

The June 2025 sheet, PDF p. 3, separates these ratings:

| Component            | Power               | Torque               |
| -------------------- | ------------------- | -------------------- |
| Combustion engine    | 183 cv at 6,000 rpm | 260 N·m at 4,500 rpm |
| Front electric motor | 231 cv              | 310 N·m              |
| Rear electric motor  | 204 cv              | 340 N·m              |

Acceleration is 5.7 seconds from 0 to 100 km/h, supported by the launch article and the sheet's performance table. The product page expressly supplies the km/h endpoint.

The Shark manual lists ECO, NORMAL and SPORT driving modes, plus Neve, Areia and Lama terrain modes (PDF p. 32 / printed 1-22). Its towing table permits 2,500 kg with trailer brakes and 750 kg without them, including trailer equipment and cargo (PDF p. 108 / printed 4-29). It also requires compliance with vehicle and hitch weight limits and a maximum 12% gradient. Towing is documented here but is not recommended for this seven-row comparison because equivalent conditions for all three vehicles have not been established.

The wading limit is explicit, not inferred from an illustration or ground clearance. The adjacent manual page discourages crossing flooded sections unless necessary; it describes slow, steady travel with the air conditioning off, no stopping or reversing, avoiding water ingestion, and precautions about EV-to-HEV switching and battery charge. Therefore 700 mm must not imply unconditional safe immersion or guaranteed water-damage coverage.

## Exact sources and applicability

1. [BYD Brazil technical sheet, June 2025](https://www.byd.com/material/byd-site/br/fichas-t%C3%A9cnicas---update-2025/Ficha_Tecnica_Shark_06_2025.pdf). Eight pages, image-based; relevant pages 1-3 inspected visually. PDF metadata last modified 2025-06-09. The filename establishes the edition date; its title identifies Shark without expressly printing a GS/2025 model-year scope. It is a period technical reference for the demo, not VIN-level homologation evidence.
2. [Brazilian launch announcement, 2024-10-25](https://www.byd.com/br/noticias-byd-brasil/chega-ao-brasil-a-byd-shark---primeira-caminhonete-super-hibrida1). Locator: the paragraph beginning with the EHS/1.5 L combination, immediately before the connectivity subsection. Official Brazilian launch configuration; the article does not expressly label its model year or GS trim.
3. [BYD Brazil Shark product page](https://www.byd.com/br/car/shark). Locator: DMO platform section, first powertrain block. Current undated page; used to confirm terminology, not to retroactively assign every current feature to 2025. Its ADAS block explicitly refers to GS.
4. [Shark owner's manual, SHARK_MP_24101](https://www.byd.com/material/byd-site/br/manuais-auto-byd/updates-11-11-2024/SHARK_MP_24101_Site.pdf). 221 pages; metadata last modified 2024-11-09. The [official manual portal](https://www.byd.com/br/manual-proprietario) associates this exact file with vehicle type BYD Shark, Portuguese, year **Todos**. This is a Shark-specific document applicable across years according to the portal, not a generic BYD manual. Relevant printed page numbers and PDF page positions appear above.
5. [Current technical sheet, revised 2026-07-09](https://www.byd.com/material/__CN/byd-site/br/fichas-tecnicas-2026/update-13-07-2026/07-13-2026---ficha-txiunica/BYD_Shark_V2.pdf). Retrieved for version checking only. PDF p. 3 now lists 650 N·m, an additional Montanha terrain mode, and 68 km electric PBEV range; p. 7 prints the revision date. Do not backport these values into the 2025 comparison.

## Retrieval record

Older search-index URLs under `/content/dam/` returned 404. The official site's current `/material/` paths above downloaded successfully. The manual path was confirmed in the portal's public model/year data; the current 2026 sheet path came directly from the product page.

Local files are under `apps/pitch/out/research-v7/byd/`:

- `shark-ficha-06-2025.pdf`, SHA-256 `c7f9ba2c3c2ca80c0c9986a8c363323446f7d387e0c8f051c03e33cfe756d74c`.
- `shark-manual-24101.pdf`, SHA-256 `f7b2daa3594d7aa3e262a957ffa15e8becabd1e9e567f94bd97174f862002114`.
- `shark-ficha-v2-current-2026.pdf`, SHA-256 `6e2af321e7e1d58a1b157472a9bf4dcca3201df6a0beb0f5db0f98374945b21d`.
- `download-manifest.json`, extracted text, original embedded images from the 2025 sheet, and rendered manual pages 32, 108, 121 and 122 for visual verification.

The document records source-backed facts separately from display wording and the derived torque conversion. No secondary automotive database, dealer specification, overseas market sheet or source-ranking claim was used to fill gaps.
