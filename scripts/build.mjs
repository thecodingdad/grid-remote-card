import esbuild from 'esbuild';
import { minifyHTMLLiterals } from '@literals/html-css-minifier';
import { readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const srcDir = join(repoRoot, 'src');
const distDir = join(repoRoot, 'dist');

const watch = process.argv.includes('--watch');
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));

/**
 * Minify the contents of html and css tagged template literals in TS
 * source files. esbuild's main `minify` flag only touches JavaScript and
 * leaves template literal contents verbatim — without this plugin the
 * bundle carries every space and newline of the source markup.
 *
 * Uses @literals/html-css-minifier which parses the source with an HTML
 * parser, handles lit-specific ${...} interpolations correctly, and
 * preserves whitespace-sensitive regions (e.g. text between inline
 * elements).
 */
const minifyTemplateLiteralsPlugin = {
  name: 'minify-template-literals',
  setup(build) {
    build.onLoad({ filter: /\.ts$/ }, async (args) => {
      const source = await readFile(args.path, 'utf8');
      // Fast path: files without any tagged templates don't need parsing.
      if (!source.includes('html`') && !source.includes('css`')) {
        return null;
      }
      try {
        const result = await minifyHTMLLiterals(source, { fileName: args.path });
        if (result) return { contents: result.code, loader: 'ts' };
      } catch (err) {
        console.warn(`[minify-template-literals] ${args.path}: ${err.message}`);
      }
      return null;
    });
  },
};

const mainBuildOptions = {
  entryPoints: [join(srcDir, 'index.ts')],
  bundle: true,
  outfile: join(distDir, 'grid-remote-card.js'),
  format: 'esm',
  target: 'es2022',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  // The banner is emitted verbatim and NOT minified, so deploy.sh's sed
  // regex can still append a dev-hash suffix to VERSION. The VERSION
  // string itself is only shown in console.info — cache-busting for
  // the whole bundle (including bundled i18n dicts) is handled by the
  // `?v=<hash>` query on the main card URL.
  banner: {
    js: `/**\n * Grid Remote Card for Home Assistant\n * v${pkg.version}\n */\nconst VERSION = '${pkg.version}';`,
  },
  plugins: [minifyTemplateLiteralsPlugin],
};

/** Remove any stale dist/i18n directory left over from earlier builds. */
function cleanStaleI18n() {
  const staleDir = join(distDir, 'i18n');
  if (existsSync(staleDir)) {
    rmSync(staleDir, { recursive: true, force: true });
  }
}

async function runBuild() {
  mkdirSync(distDir, { recursive: true });
  cleanStaleI18n();

  if (watch) {
    const ctx = await esbuild.context(mainBuildOptions);
    await ctx.watch();
    console.log('esbuild watching…');
  } else {
    await esbuild.build(mainBuildOptions);
    console.log(`build ok → ${mainBuildOptions.outfile}`);
  }
}

runBuild().catch((err) => {
  console.error(err);
  process.exit(1);
});
