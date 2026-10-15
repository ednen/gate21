// app.json holds the configuration; this only adds the sub-path the browser demo is served
// from (GitHub Pages serves the repository at /gate21/).
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
