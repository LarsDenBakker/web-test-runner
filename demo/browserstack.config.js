const {
  browserstackLauncher,
} = require('../dist/implementations/browser-launchers/browserstack-launcher');

module.exports = {
  browsers: [
    browserstackLauncher({
      project: 'wtr-demo',
      userAgents: [
        {
          browser: 'chrome',
          os: 'windows',
          os_version: '10',
        },
        {
          browser: 'firefox',
          os: 'windows',
          os_version: '10',
        },
        {
          browser: 'edge',
          os: 'windows',
          os_version: '10',
        },
      ],
    }),
  ],
};
