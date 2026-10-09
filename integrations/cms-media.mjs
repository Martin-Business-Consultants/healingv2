// Puts the CMS's images in the build, so the deployed site is static files
// only.
//
// Built pages link CMS images as /media/<active storage path> (`assetUrl` in
// src/lib/cms.ts). After `astro build`, this finds every such link in dist/,
// downloads each image from the CMS once, and writes it to dist/ at that same
// path. The paths are Active Storage signed ids: replacing an image in the
// CMS makes a new blob, so a new path, never new bytes at an old one, which is
// why public/_headers can cache /media/* for good.
//
// A missing image fails the build rather than shipping a broken picture.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MEDIA = /\/media\/((?:blobs|representations)\/redirect\/[^"'\s()<>,&?#\\]+)/g;
const TEXT = /\.(html|xml|json|txt)$/;
// Gentle on the CMS: it makes each rendition the first time it's asked for,
// and a burst of those from large photos can briefly take it down.
const CONCURRENCY = 2;
const ATTEMPTS = 5;

async function* files(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else yield full;
  }
}

// CMS_BASE_URL from the environment, else from .env, as cms() reads it.
async function cmsBaseUrl(root) {
  if (process.env.CMS_BASE_URL) return process.env.CMS_BASE_URL;
  const text = await fs.readFile(path.join(root, ".env"), "utf8").catch(() => "");
  const m = text.match(/^\s*CMS_BASE_URL\s*=\s*["']?([^"'\s]*)/m);
  return m?.[1];
}

async function download(cmsUrl, mediaPath, out) {
  const url = `${cmsUrl}/rails/active_storage/${mediaPath}`;
  let lastError;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, attempt * 10_000));
    try {
      const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(180_000) });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const type = res.headers.get("Content-Type") ?? "";
      if (!type.startsWith("image/")) throw new Error(`not an image (${type || "no Content-Type"})`);
      await fs.mkdir(path.dirname(out), { recursive: true });
      await fs.writeFile(out, Buffer.from(await res.arrayBuffer()));
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`/media/${mediaPath}: ${lastError?.message ?? lastError}`);
}

export default function cmsMedia() {
  let projectRoot;
  return {
    name: "healing:cms-media",
    hooks: {
      "astro:config:done": ({ config }) => {
        projectRoot = fileURLToPath(config.root);
      },
      "astro:build:done": async ({ dir, logger }) => {
        const cmsUrl = await cmsBaseUrl(projectRoot);
        if (!cmsUrl) throw new Error("CMS_BASE_URL must be set to put CMS images in the build");
        const base = cmsUrl.replace(/\/+$/, "");
        const root = fileURLToPath(dir);

        const paths = new Set();
        for await (const file of files(root)) {
          if (!TEXT.test(file)) continue;
          for (const m of (await fs.readFile(file, "utf8")).matchAll(MEDIA)) paths.add(m[1]);
        }

        const queue = [...paths];
        const failures = [];
        await Promise.all(
          Array.from({ length: CONCURRENCY }, async () => {
            for (let p; (p = queue.shift()); ) {
              const out = path.join(root, "media", ...decodeURIComponent(p).split("/"));
              await download(base, p, out).catch((error) => failures.push(error.message));
            }
          })
        );
        if (failures.length) throw new Error(`Couldn't download CMS images:\n  ${failures.join("\n  ")}`);
        logger.info(`${paths.size} CMS images written to media/`);
      },
    },
  };
}
