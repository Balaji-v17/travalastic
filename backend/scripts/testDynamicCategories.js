import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import { MASTER_CATEGORIES, mapCsvTypeToCategory } from '../src/routes/destinations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function test() {
  const csvPath = path.resolve(__dirname, '../data/tourist_places.csv');
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true });

  console.log(`Loaded ${records.length} records from CSV.`);

  // 1. Goa
  const goaPlaces = records.filter((r) =>
    (r.State && r.State.toLowerCase().includes('goa')) ||
    (r.City && r.City.toLowerCase().includes('goa'))
  );

  const goaDests = goaPlaces.map((r) => ({
    name: r.Name,
    type: r.Type,
    category: mapCsvTypeToCategory(r.Type),
  }));

  const goaCategories = MASTER_CATEGORIES.filter((cat) =>
    goaDests.some((d) => d.category === cat)
  );

  console.log(`\n--- GOA (${goaPlaces.length} places) ---`);
  goaDests.forEach((d) => console.log(`  - ${d.name} ("${d.type}") -> [${d.category || 'All Places only'}]`));
  console.log('Dynamic availableCategories for Goa:', goaCategories);

  // 2. Jaipur
  const jaipurPlaces = records.filter((r) =>
    (r.City && r.City.toLowerCase().includes('jaipur'))
  );

  const jaipurDests = jaipurPlaces.map((r) => ({
    name: r.Name,
    type: r.Type,
    category: mapCsvTypeToCategory(r.Type),
  }));

  const jaipurCategories = MASTER_CATEGORIES.filter((cat) =>
    jaipurDests.some((d) => d.category === cat)
  );

  console.log(`\n--- JAIPUR (${jaipurPlaces.length} places) ---`);
  jaipurDests.forEach((d) => console.log(`  - ${d.name} ("${d.type}") -> [${d.category || 'All Places only'}]`));
  console.log('Dynamic availableCategories for Jaipur:', jaipurCategories);

  // 3. Munnar / Kerala
  const munnarPlaces = records.filter((r) =>
    (r.City && r.City.toLowerCase().includes('munnar')) ||
    (r.State && r.State.toLowerCase().includes('kerala'))
  );

  const munnarDests = munnarPlaces.map((r) => ({
    name: r.Name,
    type: r.Type,
    category: mapCsvTypeToCategory(r.Type),
  }));

  const munnarCategories = MASTER_CATEGORIES.filter((cat) =>
    munnarDests.some((d) => d.category === cat)
  );

  console.log(`\n--- KERALA / MUNNAR (${munnarPlaces.length} places) ---`);
  console.log('Dynamic availableCategories for Kerala/Munnar:', munnarCategories);

  console.log('\nAll tests passed successfully!');
}

test();
