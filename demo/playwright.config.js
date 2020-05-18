const {
  playwrightLauncher,
} = require('../dist/implementations/browser-launchers/playwright-launcher');

module.exports = {
  browsers: [
    playwrightLauncher({ browserType: 'chromium' }),
    playwrightLauncher({ browserType: 'firefox' }),
    playwrightLauncher({ browserType: 'webkit' }),
  ],
};
