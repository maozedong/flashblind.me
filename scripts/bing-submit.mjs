const apiKey = process.env.BING_API_KEY;
if (!apiKey) {
  console.error("BING_API_KEY is missing");
  process.exit(1);
}

const siteUrl = "https://flashblind.me";
const url = "https://flashblind.me/";

const endpoint = `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrl?apikey=${encodeURIComponent(apiKey)}`;

const res = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ siteUrl, url }),
});

const text = await res.text();
console.log("Status:", res.status);
console.log(text || "(empty response)");
