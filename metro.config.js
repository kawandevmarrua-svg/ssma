// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const exclusionList = require('metro-config/src/defaults/exclusionList');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// O Metro observa a raiz inteira do projeto. Excluimos a pasta `web/` (Next.js),
// pastas de build/cache e diretorios do supabase para evitar erros como
// `ENOENT: no such file or directory, watch '.next/static/...'` quando o Next
// recompila e remove pastas em uso pelo watcher.
config.resolver = config.resolver || {};
config.resolver.blockList = exclusionList([
  /web[\\/].*/,
  /android[\\/]\.gradle[\\/].*/,
  /android[\\/]\.cxx[\\/].*/,
  /android[\\/]build[\\/].*/,
  /android[\\/]app[\\/]build[\\/].*/,
  /ios[\\/]build[\\/].*/,
  /supabase[\\/].*/,
  /\.next[\\/].*/,
]);

config.watchFolders = [path.resolve(__dirname)];

module.exports = config;
