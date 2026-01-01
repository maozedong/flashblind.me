import fs from "fs";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

const keyFile = process.env.GSC_SERVICE_ACCOUNT_JSON;
const propertyId = process.env.GA4_PROPERTY_ID;

if (!propertyId) {
  console.error("GA4_PROPERTY_ID is missing");
  process.exit(1);
}
if (!keyFile || !fs.existsSync(keyFile)) {
  console.error("GSC_SERVICE_ACCOUNT_JSON missing or not found:", keyFile);
  process.exit(1);
}

const client = new BetaAnalyticsDataClient({ keyFilename: keyFile });

const [response] = await client.runReport({
  property: `properties/${propertyId}`,
  dateRanges: [{ startDate: "30daysAgo", endDate: "yesterday" }],
  dimensions: [{ name: "sessionDefaultChannelGroup" }],
  metrics: [{ name: "sessions" }, { name: "totalUsers" }],
  orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
});

console.log("GA4 30d summary by channel group:");
for (const row of response.rows ?? []) {
  const channel = row.dimensionValues?.[0]?.value ?? "(unknown)";
  const sessions = row.metricValues?.[0]?.value ?? "0";
  const users = row.metricValues?.[1]?.value ?? "0";
  console.log(`${channel}: sessions=${sessions}, users=${users}`);
}
