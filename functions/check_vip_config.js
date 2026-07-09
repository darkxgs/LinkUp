const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'linkup-dc45f'
});
const db = admin.firestore();

async function run() {
  const snap = await db.collection('config').doc('vipSystem').get();
  
  if (!snap.exists) {
    console.log("No config/vipSystem document found in Firestore");
    process.exit(0);
  }
  
  console.log(JSON.stringify(snap.data(), null, 2));
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
