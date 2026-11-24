// Runs before every build (see package.json's "build" script).
//
// sql.js needs its WebAssembly binary (sql-wasm.wasm) alongside wherever it
// runs — normally it finds this itself, relative to its own folder inside
// node_modules. That broke on Hostinger: the deployed copy of this app was
// missing node_modules/sql.js/dist/sql-wasm.wasm entirely (confirmed by the
// exact ENOENT path in the error it threw), even though it clearly existed
// right after `npm install` ran on Hostinger's own build server — whatever
// Hostinger's deployment step does to package up the built app for serving,
// it isn't preserving that file. public/ doesn't have that problem: static
// assets under public/ are a basic, load-bearing part of every Next.js
// deployment (favicons, uploaded files, etc. all already depend on it), so
// copying the wasm file there ourselves — at build time, while
// node_modules still definitely has it — sidesteps whatever Hostinger's
// packaging step was dropping it for. lib/db.ts then points sql.js at this
// copy directly via its `locateFile` option, instead of letting it guess.
const fs = require("fs");
const path = require("path");

const SOURCE = path.join(__dirname, "..", "node_modules", "sql.js", "dist", "sql-wasm.wasm");
const DEST = path.join(__dirname, "..", "public", "sql-wasm.wasm");

if (!fs.existsSync(SOURCE)) {
  console.error(`copy-sql-wasm: expected to find ${SOURCE} but it's missing — is sql.js installed?`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(DEST), { recursive: true });
fs.copyFileSync(SOURCE, DEST);
console.log(`copy-sql-wasm: copied sql-wasm.wasm to ${DEST}`);
