// Configuration Metro : ajoute le support .wasm (nécessaire à expo-sqlite pour l'aperçu web).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm');

module.exports = config;
