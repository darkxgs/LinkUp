/**
 * Firebase config — نفس مشروع تطبيق LinkUp (linkup-dc45f)
 * اللوحة تقرأ وتكتب على نفس قاعدة البيانات
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: 'AIzaSyB0sVIAe63jkq0O_tU8B98GWe0SywBWaBM',
  authDomain: 'linkup-dc45f.firebaseapp.com',
  databaseURL: 'https://linkup-dc45f-default-rtdb.firebaseio.com',
  projectId: 'linkup-dc45f',
  storageBucket: 'linkup-dc45f.firebasestorage.app',
  messagingSenderId: '521319798732',
  appId: '1:521319798732:web:689bb9e8a40c4771ec2f69',
};

const app = initializeApp(firebaseConfig);

export const firestore = getFirestore(app);
export const auth = getAuth(app);
export const realtimeDb = getDatabase(app);
export const functions = getFunctions(app, 'us-central1');
export default app;
