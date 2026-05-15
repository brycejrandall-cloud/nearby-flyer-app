import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDir = join(root, "data");
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const targets = [
  ["airports.json", process.env.AIRPORTS_TABLE, row => ({ ...row, icao: String(row.icao || "").toUpperCase() })],
  ["listings.json", process.env.LISTINGS_TABLE, row => ({ ...row, icao: String(row.icao || "").toUpperCase() })],
  ["listing-aircraft.json", process.env.LISTING_AIRCRAFT_TABLE, row => row],
  ["aircraft-models.json", process.env.AIRCRAFT_MODELS_TABLE, row => ({ ...row, id: row.id || row.identifier || crypto.randomUUID() })]
];

async function loadJson(file) {
  return JSON.parse(await readFile(join(dataDir, file), "utf8"));
}

for (const [file, TableName, normalize] of targets) {
  if (!TableName) throw new Error(`Missing table env var for ${file}`);
  const rows = await loadJson(file);
  for (const row of rows) {
    const item = normalize(row);
    await client.send(new PutCommand({ TableName, Item: item }));
  }
  console.log(`Seeded ${rows.length} rows into ${TableName}`);
}

