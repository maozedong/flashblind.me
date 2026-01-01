import fs from "fs";
import { GoogleAuth } from "google-auth-library";

const keyFile = process.env.GSC_SERVICE_ACCOUNT_JSON;
const propertyId = process.env.GA4_PROPERTY_ID;

if (!propertyId) {
  console.error("GA4_PROPERTY_ID missing");
  process.exit(1);
}
if (!keyFile || !fs.existsSync(keyFile)) {
  console.error("GSC_SERVICE_ACCOUNT_JSON missing or not found:", keyFile);
  process.exit(1);
}

const conversionEvents = [
  "upload_image",
  "conversion_success",
  "download_glow_png",
  "share_x_click"
];

const auth = new GoogleAuth({
  keyFile,
  scopes: ["https://www.googleapis.com/auth/analytics.edit"],
});

const client = await auth.getClient();

async function listConversions() {
  const res = await client.request({
    url: `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/conversionEvents`,
    method: "GET",
  });
  return res.data.conversionEvents ?? [];
}

async function createConversion(eventName) {
  const res = await client.request({
    url: `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/conversionEvents`,
    method: "POST",
    data: { eventName },
  });
  return res.data;
}

const existing = await listConversions();
const existingNames = new Set(existing.map((e) => e.eventName));

const results = [];
for (const name of conversionEvents) {
  if (existingNames.has(name)) {
    results.push({ name, status: "exists" });
    continue;
  }
  try {
    await createConversion(name);
    results.push({ name, status: "created" });
  } catch (err) {
    results.push({ name, status: "error", error: err?.message || String(err) });
  }
}

console.log(JSON.stringify(results, null, 2));
