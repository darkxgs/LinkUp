const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'linkup-dc45f'
});
const db = admin.firestore();
db.collection('users').limit(5).get()
  .then(snap => {
    console.log(`Found ${snap.size} users:`);
    snap.forEach(doc => {
      const data = doc.data();
      console.log(`UID: ${doc.id}`);
      console.log(`  Name: ${data.displayName}`);
      console.log(`  Gender: ${data.profile?.gender} | legacy: ${data.gender}`);
      console.log(`  AgencyRole: ${data.agencyRole}`);
      console.log(`  AgencyId: ${data.agencyId}`);
      console.log(`  isVerified: ${data.isVerified}`);
    });
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
