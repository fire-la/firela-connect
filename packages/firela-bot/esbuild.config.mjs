import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: 'dist/worker.js',
  platform: 'browser',
  minify: false, // Keep readable for development
  external: [],
  mainFields: ['browser', 'module', 'main'], // Prefer browser exports
  define: {
    'process.env.NODE_ENV': '"development"',
  },
  logLevel: 'info',
});

console.log('Worker bundled successfully!');
