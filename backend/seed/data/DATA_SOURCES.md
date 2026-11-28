# Backend Seed Data Sources

## World Cities Dataset (`worldcities.csv`)

- **Dataset:** SimpleMaps Basic World Cities Database
- **Source URL:** https://simplemaps.com/data/world-cities
- **Licence:** Creative Commons Attribution 4.0 International (CC BY 4.0) — https://creativecommons.org/licenses/by/4.0/
- **Date Downloaded:** 2026-09-03
- **Exact CSV Header (11 columns):** `city,city_ascii,lat,lng,country,iso2,iso3,admin_name,capital,population,id`
- **Row Count:** 50,250
- **Attribution Notice:** City data © SimpleMaps (https://simplemaps.com/data/world-cities), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Modified: filtered and indexed for Travalastic.
- **Modifications for Travalastic:**
  - Validated latitude (`-90..90`), longitude (`-180..180`), and required identity/country fields; invalid rows are skipped during seeding.
  - Stored empty `population` values as `null`.
  - Computed lowercase, accent-free `searchKey` (Unicode NFD mark stripping plus explicit folding for `ł`, `ø`, `đ`, `ß`, `æ`, `œ`, `ı`, `þ`, `’`, `‘`) and indexed `{ searchKey: 1, population: -1 }` in MongoDB (`cities` collection).
  - Derived a `regions` collection from distinct `(admin_name, country)` pairs with averaged, rounded coordinates and normalized `searchKey`.

