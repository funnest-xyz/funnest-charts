// Next 16 static export writes route-segment prefetch payloads as nested files
// (docs/__next.docs/__PAGE__.txt) but the client requests the flattened name
// (docs/__next.docs.__PAGE__.txt). Static hosts don't rewrite, so prefetches 404 and
// client navigation falls back to full page loads. Write the flattened copies too.
import { copyFile, readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const OUT = new URL('../out/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

async function* walk(dir) {
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    if ((await stat(p)).isDirectory()) yield* walk(p);
    else yield p;
  }
}

let count = 0;
async function scan(dir) {
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    if (!(await stat(p)).isDirectory()) continue;
    if (name.startsWith('__next.')) {
      for await (const file of walk(p)) {
        const flat = `${name}.${relative(p, file).split(sep).join('.')}`;
        await copyFile(file, join(dir, flat));
        count++;
      }
    } else {
      await scan(p);
    }
  }
}

await scan(OUT);
console.log(`flatten-rsc: wrote ${count} prefetch files`);
