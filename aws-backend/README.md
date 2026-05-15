# Nearby Flyer AWS Backend

This is the replacement backend path for Nearby Flyer. It gives the static site a stable AWS API instead of reading Supabase views directly from the browser.

## What This Includes

- API Gateway HTTP API
- Lambda backend in Node.js 20
- DynamoDB tables for airports, listings, listing aircraft, aircraft models, and requests
- CORS enabled for `https://nearbyflyer.com`
- Export script for the current Supabase public data
- Seed script for DynamoDB

## Local Setup

```bash
cd aws-backend
npm install
```

Export the current public Supabase data:

```bash
SUPABASE_URL="https://sohwejfsccmfsbectjif.supabase.co" \
SUPABASE_ANON_KEY="your-public-supabase-key" \
npm run export:supabase
```

Deploy to AWS:

```bash
sam build
sam deploy --guided
```

Seed DynamoDB after deploy. Use the table names from the CloudFormation outputs or AWS console:

```bash
AIRPORTS_TABLE="NearbyFlyerAirports" \
LISTINGS_TABLE="NearbyFlyerListings" \
LISTING_AIRCRAFT_TABLE="NearbyFlyerListingAircraft" \
AIRCRAFT_MODELS_TABLE="NearbyFlyerAircraftModels" \
npm run seed:dynamodb
```

## Connect The Website

After deploy, set this before the main app script on the website:

```html
<script>
  window.NEARBY_FLYER_API_BASE = "https://your-api-id.execute-api.us-west-2.amazonaws.com";
</script>
```

The site will then load airport boards and listings from AWS. If that variable is missing, it still falls back to Supabase while you migrate.

