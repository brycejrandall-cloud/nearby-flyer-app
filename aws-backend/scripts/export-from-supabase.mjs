import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "data");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY before exporting.");
}

const headers = {
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`,
  Accept: "application/json"
};

async function fetchTable(table, query = "select=*") {
  const url = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/${table}?${query}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`${table} export failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function save(name, rows) {
  await writeFile(join(outDir, `${name}.json`), `${JSON.stringify(rows, null, 2)}\n`);
  console.log(`Saved ${rows.length} ${name} rows`);
}

await mkdir(outDir, { recursive: true });

await save("airports", await fetchTable("airport_map_markers", "select=*&order=icao.asc"));
await save("listings", await fetchTable("public_listing_details", "select=*&order=title.asc"));
await save("listing-aircraft", await fetchTable("listing_aircraft", "select=*&order=listing_id.asc"));
await save("aircraft-models", await fetchTable("aircraft_models", "select=*&active=eq.true&order=manufacturer.asc,model.asc"));

