/** @type {import('next').NextConfig} */
const nextConfig = {
  // sql.js (the accounts database) ships Emscripten-generated Node glue
  // code that loads a .wasm file via a plain Node `require`/`fs.readFile`
  // at runtime. Letting webpack bundle/transform that file for Server
  // Components breaks it; this tells Next.js to leave it alone and load
  // it with native `require` on the server instead, where it works as
  // designed since the full node_modules tree is present at runtime.
  serverExternalPackages: ["sql.js"],
};

export default nextConfig;
