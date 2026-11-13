import { cpSync, mkdirSync } from "node:fs";
const target = new URL("../public/pdfjs/", import.meta.url);
mkdirSync(target, {recursive: true});
for (const dir of ["cmaps", "standard_fonts", "wasm"]) {
  cpSync(new URL("../node_modules/pdfjs-dist/" + dir, import.meta.url), new URL(dir, target), {recursive: true});
}
