// Ajoute une adresse de base pour l'aperçu web publié sur GitHub Pages (WEB_BASE_URL=/motminute).
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.WEB_BASE_URL ? { baseUrl: process.env.WEB_BASE_URL } : {}),
  },
});
