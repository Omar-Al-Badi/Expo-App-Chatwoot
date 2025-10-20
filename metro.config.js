const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude WhatsApp session folder from file watching
config.watchFolders = [];
config.resolver.blockList = [
  /\.wwebjs_auth\/.*/,
  /\.wwebjs_cache\/.*/,
];

module.exports = config;
