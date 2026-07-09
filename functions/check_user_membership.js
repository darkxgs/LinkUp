const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'linkup-dc45f'
});
const db = admin.firestore();

async function run() {
  const snap = await db.collection('agencyMembers').where('uid', '==', 'CFeeqcEzUoQ3rUbkIIWhiYrk9ih2').get();
  
  if (snap.empty) {
    console.log("No membership document found for user CFeeqcEzUoQ3rUbkIIWhiYrk9ih2");
    process.exit(0);
  }
  
  snap.forEach(doc => {
    console.log("Membership ID:", doc.id);
    console.log(JSON.stringify(doc.data(), null, 2));
  });
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
