import fs from "fs";
import { GoogleAuth } from "google-auth-library";

const siteUrl = "sc-domain:flashblind.me";
const sitemapUrl = "https://flashblind.me/sitemap.xml";
const keyFile = process.env.GSC_SERVICE_ACCOUNT_JSON;

if (!keyFile || !fs.existsSync(keyFile)) {
  console.error("GSC_SERVICE_ACCOUNT_JSON missing or not found:", keyFile);
  process.exit(1);
}

const auth = new GoogleAuth({
  keyFile,
  scopes: ["https://www.googleapis.com/auth/webmasters"],
});

const client = await auth.getClient();

const res = await client.request({
  url: `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
  method: "PUT",
});

console.log("Sitemap submission response:", res.status);
