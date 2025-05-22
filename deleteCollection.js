const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function deleteCollection(collectionPath, batchSize = 100) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(query, resolve) {
  try {
    const snapshot = await query.get();

    if (snapshot.empty) {
      return resolve();
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Deleted batch of ${snapshot.docs.length} documents`);

    await new Promise(resolve => setTimeout(resolve, 100));

    process.nextTick(() => {
      deleteQueryBatch(query, resolve);
    });
  } catch (error) {
    if (error.code === 3 && error.details?.includes('Transaction too big')) {
      console.log('Batch too large, reducing batch size and retrying...');
      const newBatchSize = Math.floor(query._limit / 2);
      const newQuery = query.limit(newBatchSize);
      return deleteQueryBatch(newQuery, resolve);
    }
    throw error;
  }
}

// Get collection name from command line arguments
const collectionName = process.argv[2];

if (!collectionName) {
  console.error('❌ Error: Collection name is required');
  console.log('Usage: node deleteCollection.js <collection-name>');
  process.exit(1);
}

console.log(`Starting deletion of collection '${collectionName}'...`);

// Start deletion
deleteCollection(collectionName)
  .then(() => console.log(`✅ Collection '${collectionName}' deleted successfully`))
  .catch(err => {
    console.error('❌ Error deleting collection:', err);
    process.exit(1);
  });
