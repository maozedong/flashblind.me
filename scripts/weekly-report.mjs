import fs from "fs";
import { GoogleAuth } from "google-auth-library";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

const keyFile = process.env.GSC_SERVICE_ACCOUNT_JSON;
const ga4PropertyId = process.env.GA4_PROPERTY_ID;
const siteUrl = "sc-domain:flashblind.me";

if (!keyFile || !fs.existsSync(keyFile)) {
  console.error("GSC_SERVICE_ACCOUNT_JSON missing or not found:", keyFile);
  process.exit(1);
}
if (!ga4PropertyId) {
  console.error("GA4_PROPERTY_ID missing");
  process.exit(1);
}

const today = new Date();
const endDate = new Date(today);
endDate.setDate(endDate.getDate() - 1);
const startDate = new Date(today);
startDate.setDate(startDate.getDate() - 7);

const fmt = (d) => d.toISOString().slice(0, 10);

async function fetchGscTotals() {
  const auth = new GoogleAuth({ keyFile, scopes: ["https://www.googleapis.com/auth/webmasters.readonly"] });
  const client = await auth.getClient();
  const res = await client.request({
    url: `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    method: "POST",
    data: {
      startDate: fmt(startDate),
      endDate: fmt(endDate),
      rowLimit: 1,
      type: "web",
      dimensions: []
    }
  });

  const row = res.data.rows?.[0];
  return {
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    ctr: row?.ctr ?? 0,
    position: row?.position ?? 0
  };
}

async function fetchGa4Totals() {
  const client = new BetaAnalyticsDataClient({ keyFilename: keyFile });
  const [response] = await client.runReport({
    property: `properties/${ga4PropertyId}`,
    dateRanges: [{ startDate: fmt(startDate), endDate: fmt(endDate) }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }]
  });

  const row = response.rows?.[0];
  return {
    sessions: row?.metricValues?.[0]?.value ?? "0",
    users: row?.metricValues?.[1]?.value ?? "0"
  };
}

async function fetchGa4Events() {
  const client = new BetaAnalyticsDataClient({ keyFilename: keyFile });
  const [response] = await client.runReport({
    property: `properties/${ga4PropertyId}`,
    dateRanges: [{ startDate: fmt(startDate), endDate: fmt(endDate) }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        inListFilter: {
          values: ["upload_image", "conversion_success", "download_glow_png", "share_x_click"]
        }
      }
    }
  });

  const events = {};
  for (const row of response.rows ?? []) {
    const name = row.dimensionValues?.[0]?.value ?? "(unknown)";
    const count = row.metricValues?.[0]?.value ?? "0";
    events[name] = count;
  }
  return events;
}

function readIndexNowState() {
  const path = "/opt/flashblind/.state/indexnow-last.json";
  if (!fs.existsSync(path)) return null;
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

const [gsc, ga4Totals, ga4Events] = await Promise.all([
  fetchGscTotals().catch(() => null),
  fetchGa4Totals().catch(() => null),
  fetchGa4Events().catch(() => ({}))
]);

const indexNow = readIndexNowState();

const lines = [];
lines.push(`Flashblind weekly report (${fmt(startDate)} to ${fmt(endDate)})`);
lines.push("");
if (gsc) {
  lines.push(`GSC: clicks ${gsc.clicks}, impressions ${gsc.impressions}, CTR ${(gsc.ctr * 100).toFixed(2)}%, pos ${gsc.position.toFixed(1)}`);
} else {
  lines.push("GSC: unavailable (permission or data delay)");
}
if (ga4Totals) {
  lines.push(`GA4: sessions ${ga4Totals.sessions}, users ${ga4Totals.users}`);
} else {
  lines.push("GA4: unavailable (permission or data delay)");
}
lines.push(`Events: upload ${ga4Events.upload_image ?? 0}, convert ${ga4Events.conversion_success ?? 0}, download ${ga4Events.download_glow_png ?? 0}, share ${ga4Events.share_x_click ?? 0}`);

if (indexNow) {
  lines.push(`IndexNow: last submit ${indexNow.ts} (status ${indexNow.status})`);
} else {
  lines.push("IndexNow: no submission log yet");
}

console.log(lines.join("\n"));
