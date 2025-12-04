const admin = require('firebase-admin');

// Initialize Firebase Admin SDK using the credentials
const serviceAccount = require('./runmysale-b68ad-firebase-adminsdk-fbsvc-ec5b0f8416.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;
