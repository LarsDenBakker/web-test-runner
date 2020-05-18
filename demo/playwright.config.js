const {
  playwrightLauncher,
} = require('../dist/implementations/browser-launchers/playwright-launcher');

module.exports = {
  browserLauncher: playwrightLauncher({ browserType: 'webkit' }),
};
