// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// O Metro observa a raiz inteira do projeto. Excluimos a pasta `web/` (Next.js),
// pastas de build/cache e diretorios do supabase para evitar erros como
// `ENOENT: no such file or directory, watch '.next/static/...'` quando o Next
// recompila e remove pastas em uso pelo watcher.
// Padroes ancorados na raiz do projeto para nao casarem com node_modules
// (ex.: `node_modules\@supabase\supabase-js` contem `supabase\` no meio do
// caminho e estava sendo bloqueado por engano).
const projectRoot = path.resolve(__dirname).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sep = '[\\\\/]';
const blockPatterns = [
  new RegExp(`^${projectRoot}${sep}web${sep}.*`),
  new RegExp(`^${projectRoot}${sep}android${sep}\\.gradle${sep}.*`),
  new RegExp(`^${projectRoot}${sep}android${sep}\\.cxx${sep}.*`),
  new RegExp(`^${projectRoot}${sep}android${sep}build${sep}.*`),
  new RegExp(`^${projectRoot}${sep}android${sep}app${sep}build${sep}.*`),
  new RegExp(`^${projectRoot}${sep}ios${sep}build${sep}.*`),
  new RegExp(`^${projectRoot}${sep}supabase${sep}.*`),
  new RegExp(`^${projectRoot}${sep}\\.next${sep}.*`),
];

config.resolver = config.resolver || {};
config.resolver.blockList = new RegExp(
  blockPatterns.map((r) => r.source).join('|'),
);

config.watchFolders = [path.resolve(__dirname)];

module.exports = config;
