import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import webpush from "web-push";

const subject = process.argv[2];
if (!subject || !/^https:\/\//.test(subject)) {
  throw new Error("Usage: node scripts/configure-secrets.mjs https://your-worker.example");
}

const values = Object.fromEntries(
  readFileSync(new URL("../.dev.vars", import.meta.url), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return [key, value];
    }),
);

for (const required of ["APP_PASSWORD", "SESSION_SECRET"]) {
  if (!values[required]) throw new Error(`${required} is missing from .dev.vars`);
}

const vapid = webpush.generateVAPIDKeys();
const secrets = {
  APP_PASSWORD: values.APP_PASSWORD,
  SESSION_SECRET: values.SESSION_SECRET,
  VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  VAPID_SUBJECT: subject,
};

for (const [name, value] of Object.entries(secrets)) {
  const wrangler = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
  const result = spawnSync(process.execPath, [wrangler, "secret", "put", name], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    input: `${value}\n`,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`Could not upload ${name}: ${result.error?.message || result.stderr || result.stdout || "unknown error"}`);
  }
  console.log(`Configured ${name}`);
}
