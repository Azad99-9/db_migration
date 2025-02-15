const functions = require("firebase-functions");
const admin = require("firebase-admin");

const BATCH_SIZE = 100; 

exports.updateUploadsSharedWith = functions.https.onRequest(async (req, res) => {
  const uploadsRef = admin.firestore().collection('uploads');
  
  const lastProcessedDocKey = req.body.lastProcessedDocKey || null;

  try {
    const newLastKey = await processUploads(uploadsRef, lastProcessedDocKey);
    return res.status(200).send({ message: "Batch processing completed successfully.", lastProcessedDocKey: newLastKey });
  } catch (error) {
    console.error("Error processing uploads:", error);
    return res.status(500).send("Error processing uploads.");
  }
});

async function processUploads(uploadsRef, lastProcessedDocKey) {
  let query;

  if (lastProcessedDocKey) {
    const lastDocSnapshot = await uploadsRef.doc(lastProcessedDocKey).get();
    query = query.startAfter(lastDocSnapshot).limit(BATCH_SIZE);
  } else {
    query = query.limit(BATCH_SIZE);
  }

  const snapshot = await query.get();
  if (snapshot.empty) {
    console.log("No more documents to process.");
    return null;
  }

  const batch = admin.firestore().batch();

  snapshot.docs.forEach((doc) => {
    const docData = doc.data();
    const faces = docData.faces || [];
    faces = faces.map((face) => face.replaceFirst("users/", "")).toList();
    const ownerId = docData.owner_id;
    const sharedWith = new Set([...faces, ownerId]);

    batch.update(doc.ref, { shared_with: Array.from(sharedWith) });
  });

  await batch.commit();

  const lastDoc = snapshot.docs[snapshot.docs.length - 1];

  return lastDoc.key;
}

