import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./scripts/path-alias-loader.mjs", pathToFileURL("./"));
