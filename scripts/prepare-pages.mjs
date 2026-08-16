import { rename, rm } from "node:fs/promises";

const clientRoot = new URL("../dist/client/", import.meta.url);
const prefixedAssets = new URL("surf-calendar/_next/", clientRoot);
const publishedAssets = new URL("_next/", clientRoot);
const prefixDirectory = new URL("surf-calendar/", clientRoot);

await rm(publishedAssets, { force: true, recursive: true });
await rename(prefixedAssets, publishedAssets);
await rm(prefixDirectory, { force: true, recursive: true });
