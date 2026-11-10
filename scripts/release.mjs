// Publish every package to npm in dependency order. Works in PowerShell, cmd and bash.
//   pnpm release             # npm asks for the 2FA code (or opens the browser)
//   pnpm release 123456      # pass the 6-digit 2FA code (valid ~30s)
// `pnpm pack` first so workspace:* becomes the real version, then `npm publish` the tarball.
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const OUT = join(ROOT, '.release');
const ORDER = ['viz', 'core', 'ui', 'react', 'cli', 'mcp'];
const otp = process.argv[2];

const run = (cmd, cwd = ROOT) => execSync(cmd, { cwd, stdio: 'inherit', shell: true });
const quiet = (cmd) => {
  try {
    return execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'], shell: true }).toString().trim();
  } catch {
    return '';
  }
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
run('pnpm build');
for (const pkg of ORDER) execSync(`pnpm pack --pack-destination "${OUT}"`, { cwd: join(ROOT, 'packages', pkg), stdio: 'ignore', shell: true });

for (const pkg of ORDER) {
  const { name, version } = JSON.parse(readFileSync(join(ROOT, 'packages', pkg, 'package.json'), 'utf8'));
  if (quiet(`npm view ${name}@${version} version`) === version) {
    console.log(`skip ${name}@${version} (already published)`);
    continue;
  }
  const file = join(OUT, `${name.replace('@', '').replace('/', '-')}-${version}.tgz`);
  console.log(`\npublish ${name}@${version}`);
  run(`npm publish "${file}" --access public${otp ? ` --otp=${otp}` : ''}`);
}
console.log('\ndone');
