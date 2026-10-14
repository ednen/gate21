// The content packs live at the repository root (shared with the API), so Metro must watch them.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../content')];

module.exports = config;
