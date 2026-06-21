import { existsSync } from "node:fs";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return nextResolve(pathToFileURL(`${process.cwd()}/scripts/noop-server-only.mjs`).href, context);
  }

  if (specifier.startsWith("@/")) {
    let path = `${process.cwd()}/${specifier.slice(2)}`;
    if (!extname(path) && existsSync(`${path}.js`)) {
      path = `${path}.js`;
    }
    const url = pathToFileURL(path).href;
    return nextResolve(url, context);
  }

  return nextResolve(specifier, context);
}
