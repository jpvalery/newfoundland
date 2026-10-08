// pnpm build: bundles src/ and copies the static site into dist/.
// pnpm dev: serves the repo on http://localhost:8000 and rebuilds app.js when
// a file in src/ changes. Opening index.html from disk does not work: browsers
// block the fetch of img/map.svg on file:// URLs.
import fs from 'node:fs'
import * as esbuild from 'esbuild'

const STATIC_FILES = [
  'index.html',
  'favicon.ico',
  'apple-touch-icon.png',
  'css',
  'fonts',
  'img',
]

const options = {
  entryPoints: ['src/index.js'],
  bundle: true,
  minify: true,
  target: 'es2020',
  logLevel: 'info',
}

if (process.argv.includes('--serve')) {
  const ctx = await esbuild.context({
    ...options,
    outfile: 'app.js',
    sourcemap: 'inline',
    write: false,
  })
  await ctx.watch()
  await ctx.serve({ servedir: '.', port: 8000 })
} else {
  fs.rmSync('dist', { recursive: true, force: true })
  await esbuild.build({ ...options, outfile: 'dist/app.js' })
  for (const file of STATIC_FILES) {
    fs.cpSync(file, `dist/${file}`, { recursive: true })
  }
}
