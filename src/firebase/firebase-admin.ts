// src/firebase/firebase-admin.ts
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Resolve JSON path ALWAYS from project root
const serviceAccountPath = path.resolve(
  __dirname,
  '../../../src/firebase/runmysale-b68ad-firebase-adminsdk-fbsvc-ec5b0f8416.json'
);

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Firebase JSON file not found at:', serviceAccountPath);
  throw new Error('Firebase service account JSON missing');
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;
