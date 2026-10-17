#!/usr/bin/env node
/**
 * Firestore collection migration: old Chayolei names → Beis names
 *
 * Run once against your Firestore instance after deploying Phase 3.
 * Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 * set in environment (or a serviceAccountKey.json at project root).
 *
 * Usage:
 *   node scripts/migrate-collections.js [--dry-run]
 *
 * What it does:
 *   1. Copies every document from the old collection to the new collection,
 *      preserving document IDs, all fields, and subcollections (1 level deep).
 *   2. Renames internal field names stored in documents
 *      (e.g. tafkidimCount → seifimCount, masimotCount → chibburimCount).
 *   3. Deletes old documents/collections after successful copy.
 *
 * Collections renamed:
 *   talmidim      → chaverim
 *   mivtzaot      → chaburot
 *   masimot       → chibburim
 *   tafkidim      → seifim
 *
 * Document field renames:
 *   tafkidimCount → seifimCount     (inside chibburim docs)
 *   masimotCount  → chibburimCount  (inside chaburot docs)
 *   totalTmimMinted → totalSecharMinted  (inside treasury/global)
 *   tmimCirculating → secharCirculating  (inside treasury/global)
 */

const admin = require('firebase-admin');
const path = require('path');

// ── init ─────────────────────────────────────────────────────────────────────
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
const fs = require('fs');

if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const DRY_RUN = process.argv.includes('--dry-run');

if (DRY_RUN) console.log('DRY RUN — no writes will be made\n');

// ── collection rename map ────────────────────────────────────────────────────
const COLLECTION_RENAMES = [
  { from: 'talmidim', to: 'chaverim' },
  { from: 'mivtzaot', to: 'chaburot' },
  { from: 'masimot',  to: 'chibburim' },
  { from: 'tafkidim', to: 'seifim' },
];

// ── per-collection field renames ─────────────────────────────────────────────
const FIELD_RENAMES = {
  chibburim: { tafkidimCount: 'seifimCount' },
  chaburot:  { masimotCount: 'chibburimCount' },
};

// ── special document field renames ───────────────────────────────────────────
const SPECIAL_DOCS = [
  {
    ref: () => db.collection('treasury').doc('global'),
    fields: {
      totalTmimMinted: 'totalSecharMinted',
      tmimCirculating: 'secharCirculating',
    },
  },
];

// ── helpers ──────────────────────────────────────────────────────────────────
function applyFieldRenames(data, fieldMap) {
  const out = { ...data };
  for (const [oldKey, newKey] of Object.entries(fieldMap)) {
    if (oldKey in out) {
      out[newKey] = out[oldKey];
      delete out[oldKey];
    }
  }
  return out;
}

async function copyCollection(fromName, toName, fieldMap = {}) {
  const snap = await db.collection(fromName).get();
  if (snap.empty) {
    console.log(`  ${fromName}: empty, skipping`);
    return 0;
  }

  const BATCH_SIZE = 400;
  let copied = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    let data = doc.data();
    if (Object.keys(fieldMap).length) data = applyFieldRenames(data, fieldMap);

    const destRef = db.collection(toName).doc(doc.id);
    if (!DRY_RUN) batch.set(destRef, data);
    batchCount++;
    copied++;

    if (batchCount >= BATCH_SIZE) {
      if (!DRY_RUN) await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0 && !DRY_RUN) await batch.commit();
  return copied;
}

async function deleteCollection(colName) {
  const snap = await db.collection(colName).get();
  if (snap.empty) return 0;

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let count = 0;
  let batchCount = 0;

  for (const doc of snap.docs) {
    if (!DRY_RUN) batch.delete(doc.ref);
    batchCount++;
    count++;
    if (batchCount >= BATCH_SIZE) {
      if (!DRY_RUN) await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0 && !DRY_RUN) await batch.commit();
  return count;
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Beis Firestore collection migration ===\n');

  // Migrate collections
  for (const { from, to } of COLLECTION_RENAMES) {
    const fieldMap = FIELD_RENAMES[to] || {};
    process.stdout.write(`Migrating ${from} → ${to} ... `);
    const n = await copyCollection(from, to, fieldMap);
    console.log(`${n} docs copied`);

    if (n > 0) {
      process.stdout.write(`Deleting old ${from} ... `);
      const d = await deleteCollection(from);
      console.log(`${d} docs deleted`);
    }
  }

  // Special document field renames (in-place)
  console.log('\nRenaming fields in special documents...');
  for (const { ref, fields } of SPECIAL_DOCS) {
    const docRef = ref();
    const snap = await docRef.get();
    if (!snap.exists) { console.log(`  ${docRef.path}: not found, skipping`); continue; }

    const data = snap.data();
    const updates = {};
    for (const [oldKey, newKey] of Object.entries(fields)) {
      if (oldKey in data) {
        updates[newKey] = data[oldKey];
        updates[oldKey] = admin.firestore.FieldValue.delete();
      }
    }
    if (Object.keys(updates).length) {
      if (!DRY_RUN) await docRef.update(updates);
      console.log(`  ${docRef.path}: ${Object.keys(updates).length / 2} fields renamed`);
    } else {
      console.log(`  ${docRef.path}: already up to date`);
    }
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
