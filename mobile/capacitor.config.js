const app = require('./app.config.json');

/** @type {import('@capacitor/cli').CapacitorConfig} */
module.exports = {
  appId: app.appId,
  appName: app.appName,
  webDir: 'www',
  server: {
    androidScheme: 'https',
    // Only for testing against a plain-http backend (e.g. http://10.0.2.2:3000 on the Android emulator).
    // Leave OFF for release builds: DEV_CLEARTEXT=1 npm run sync
    cleartext: process.env.DEV_CLEARTEXT === '1'
  },
  ios: { contentInset: 'automatic' }
};
