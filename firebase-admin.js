const admin = require('firebase-admin');
const serviceAccount = require('./runmysale-b68ad-firebase-adminsdk-fbsvc-ec5b0f8416.json');

// Only initialize if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;
