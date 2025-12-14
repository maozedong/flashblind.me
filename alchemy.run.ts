import alchemy from "alchemy";
import { Website } from "alchemy/cloudflare";
import { CloudflareStateStore, FileSystemStateStore } from "alchemy/state";

const app = await alchemy("flashblind", {
  password: alchemy.env("ALCHEMY_PASSWORD"),
  stateStore: (scope) =>
    scope.local ? new FileSystemStateStore(scope) : new CloudflareStateStore(scope),
});

const isProd = app.stage === "prod";

const site = await Website("site", {
  name: isProd ? "flashblind" : `flashblind-${app.stage}`,
  build: "bun run build",
  dev: "bunx serve dist -l 3000",
  assets: "./dist",
  domains: isProd ? ["flashblind.me"] : undefined,
  workers_dev: !isProd,
});

console.log(`stage=${app.stage} local=${app.local} url=${site.url}`);
await app.finalize();

if (app.local) {
  await new Promise(() => {}); // keep dev server alive
}
