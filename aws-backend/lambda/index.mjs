import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand
} from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const tables = {
  airports: process.env.AIRPORTS_TABLE,
  listings: process.env.LISTINGS_TABLE,
  listingAircraft: process.env.LISTING_AIRCRAFT_TABLE,
  aircraftModels: process.env.AIRCRAFT_MODELS_TABLE,
  requests: process.env.REQUESTS_TABLE
};

const allowedOrigins = new Set([
  process.env.ALLOWED_ORIGIN,
  "https://www.nearbyflyer.com",
  "http://localhost:3000",
  "http://localhost:5173"
].filter(Boolean));

function response(statusCode, body, event) {
  const origin = event?.headers?.origin || event?.headers?.Origin || "";
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": allowedOrigins.has(origin) ? origin : process.env.ALLOWED_ORIGIN || "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization,x-requested-with"
    },
    body: JSON.stringify(body)
  };
}

function cleanPath(event) {
  return (event.rawPath || event.path || "/").replace(/\/+$/, "") || "/";
}

function id() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

async function scanTable(TableName) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const page = await client.send(new ScanCommand({ TableName, ExclusiveStartKey }));
    items.push(...(page.Items || []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function getAirport(icao) {
  const result = await client.send(new GetCommand({
    TableName: tables.airports,
    Key: { icao: String(icao || "").toUpperCase() }
  }));
  return result.Item || null;
}

async function listingsByIcao(icao) {
  const result = await client.send(new QueryCommand({
    TableName: tables.listings,
    IndexName: "byIcao",
    KeyConditionExpression: "icao = :icao",
    ExpressionAttributeValues: { ":icao": String(icao || "").toUpperCase() }
  }));
  return result.Items || [];
}

async function createRequest(request_type, payload) {
  const item = {
    id: id(),
    request_type,
    status: "new",
    created_at: now(),
    ...payload
  };
  await client.send(new PutCommand({ TableName: tables.requests, Item: item }));
  return item;
}

export async function handler(event) {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return response(204, {}, event);
  }

  const method = event.requestContext?.http?.method || event.httpMethod || "GET";
  const path = cleanPath(event);

  try {
    if (method === "GET" && path === "/health") {
      return response(200, { ok: true, service: "nearby-flyer-api" }, event);
    }

    if (method === "GET" && path === "/airports") {
      const airports = await scanTable(tables.airports);
      airports.sort((a, b) => String(a.icao).localeCompare(String(b.icao)));
      return response(200, airports, event);
    }

    const airportMatch = path.match(/^\/airports\/([^/]+)$/);
    if (method === "GET" && airportMatch) {
      const airport = await getAirport(decodeURIComponent(airportMatch[1]));
      return airport ? response(200, airport, event) : response(404, { error: "Airport not found" }, event);
    }

    if (method === "GET" && path === "/listings") {
      const icao = event.queryStringParameters?.icao;
      const listings = icao ? await listingsByIcao(icao) : await scanTable(tables.listings);
      listings.sort((a, b) => String(a.title || a.display_name || "").localeCompare(String(b.title || b.display_name || "")));
      return response(200, listings, event);
    }

    if (method === "GET" && path === "/listing-aircraft") {
      return response(200, await scanTable(tables.listingAircraft), event);
    }

    if (method === "GET" && path === "/aircraft-models") {
      return response(200, await scanTable(tables.aircraftModels), event);
    }

    if (method === "POST" && path === "/listing-submissions") {
      const payload = JSON.parse(event.body || "{}");
      return response(201, await createRequest("listing_submission", payload), event);
    }

    if (method === "POST" && path === "/claim-requests") {
      const payload = JSON.parse(event.body || "{}");
      return response(201, await createRequest("claim_request", payload), event);
    }

    if (method === "POST" && path === "/featured-upgrade-requests") {
      const payload = JSON.parse(event.body || "{}");
      return response(201, await createRequest("featured_upgrade_request", payload), event);
    }

    return response(404, { error: "Not found" }, event);
  } catch (error) {
    console.error(error);
    return response(500, { error: "Backend error" }, event);
  }
}

