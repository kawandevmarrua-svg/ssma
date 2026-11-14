// Config de monorepo: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Observa o workspace inteiro (necessário para resolver packages/shared),
// mas bloqueia apps/web, builds do Android e supabase — o Next recria/remove
// pastas em uso pelo watcher e causa ENOENT.
config.watchFolders = [workspaceRoot];

const esc = (p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sep = '[\\\\/]';
const wsRoot = esc(workspaceRoot);
const blockPatterns = [
  new RegExp(`^${wsRoot}${sep}apps${sep}web${sep}.*`),
  new RegExp(`^${wsRoot}${sep}supabase${sep}.*`),
  new RegExp(`^${esc(projectRoot)}${sep}android${sep}\\.gradle${sep}.*`),
  new RegExp(`^${esc(projectRoot)}${sep}android${sep}\\.cxx${sep}.*`),
  new RegExp(`^${esc(projectRoot)}${sep}android${sep}build${sep}.*`),
  new RegExp(`^${esc(projectRoot)}${sep}android${sep}app${sep}build${sep}.*`),
];

config.resolver = config.resolver || {};
config.resolver.blockList = new RegExp(
  blockPatterns.map((r) => r.source).join('|'),
);

// npm workspaces faz hoisting: dependências podem estar no node_modules da
// raiz ou no do app.
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, 'node_modules'),
  path.join(workspaceRoot, 'node_modules'),
];

module.exports = config;
