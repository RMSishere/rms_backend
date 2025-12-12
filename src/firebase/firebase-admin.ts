import * as admin from 'firebase-admin';
import * as path from 'path';

const serviceAccount = require(path.join(__dirname, 'firebase', 'runmysale-b68ad-firebase-adminsdk-fbsvc-ec5b0f8416.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;
