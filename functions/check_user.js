const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'linkup-dc45f'
});
const db = admin.firestore();

async function run() {
  let snap = await db.collection('users').where('publicAccountId', '==', '59067910').get();
  if (snap.empty) {
    snap = await db.collection('users').where('publicAccountId', '==', 59067910).get();
  }
  
  if (snap.empty) {
    console.log("User not found by publicAccountId 59067910");
    process.exit(0);
  }
  
  snap.forEach(doc => {
    console.log("User doc ID:", doc.id);
    console.log(JSON.stringify(doc.data(), null, 2));
  });
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
