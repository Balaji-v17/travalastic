# Heritage Monuments Seed Source (`heritage_sites.csv`)

- **Dataset:** `therajasekhar/india-public-cultural-heritage` (`data/heritage_sites.parquet`, exported as `heritage_sites.csv`)
- **Upstream Provenance:** Archaeological Survey of India (ASI) and Survey of India (SOI) monuments via Bhuvan, packaged via [`ramSeraph/indian_facilities` release `cultural`](https://github.com/ramSeraph/indian_facilities/releases/tag/cultural)
- **Date Generated / Retrieved (`sources.json`):** `2026-11-19`
- **Licence / Terms:** NDSAP; licence terms at source to be confirmed.
- **Exact CSV Header (12 columns):** `entity_uid,site_name,description,location,state,district,asi_circle,protected_by,longitude,latitude,geometry,source`
- **Row Counts:** 6,879 total rows (4,283 ASI, 2,596 SOI); 2,519 rows have empty `site_name` (skipped during seeding) and 4,360 named rows represent 4,119 unique `entity_uid` records (`241` duplicate `entity_uid` geometry rows).
- **Attribution Notice:** Heritage site data: Archaeological Survey of India and Survey of India (via Bhuvan), as compiled in therajasekhar/india-public-cultural-heritage under NDSAP. Locations are approximate. Licence terms at source to be confirmed.

## Transformations & Quality Controls for Travalastic

- **Unpublished by default:** All imported records are stored in `touristplaces` with `hidden: true`, `hiddenReason: 'pending_review'`, `isCurated: false`, `source: 'asi-soi-heritage'`, `type: 'Heritage monument'`, and `embeddingStale: true` (no embedding API calls during import). Records only become public after an admin reviews and publishes them in the Admin Panel.
- **Null-safe attributes:** `googleRating`, `entranceFeeINR`, `timeNeededHours`, and `bestTimeToVisit` remain `null` (never defaulted to `0`).
- **Approximate coordinates:** Source coordinates are bounding-box centroids, so `heritage.coordsApprox` is set to `true` on all imported heritage records. Coordinates outside India's bounding box (`lat` 6.5–37.5, `lng` 68–97.5; `asi:GUWNL071`) are flagged `coords_outside_india`.
- **State normalization:** Mapped `Chhatisgarh` → `Chhattisgarh`, `DADAR & NAGAR HAVELI` → `Dadra and Nagar Haveli`, `DAMAN & DIU` → `Daman and Diu`, `Jammu & Kashmir` → `Jammu and Kashmir`, and title-cased remaining state names. Empty states (327 rows) remain `null` with review flag `state_unmapped`.
- **Deduplication / Grouping:** Grouped by `(normalised site_name, district, state)`; kept one representative (`ASI > SOI`, non-empty description, lowest `entity_uid`), linked merged source IDs in `heritage.mergedSourceIds`, and marked extras `hidden: true, hiddenReason: 'duplicate'` (`possible_duplicate`).
- **Quality flags:** Records are flagged with `broken_text`, `coords_outside_india`, `generic_name`, `state_unmapped` (blocking publish until resolved), and `no_description`, `possible_duplicate` (informational).

## Local Files & Running the Importer

`heritage_sites.csv` and `sources.json` are excluded from git (`.gitignore`). Place both files under `backend/seed/data/heritage/` before running:

```bash
cd backend
npm run seed:heritage
```

Against production (pass URI via environment variable; never commit or log the URI):

```bash
cd backend && MONGODB_URI="<your-production-mongodb-uri>" npm run seed:heritage
```
