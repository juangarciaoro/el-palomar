#!/usr/bin/env node
/**
 * restore-firestore.js
 * Restaura las colecciones raíz de Firestore desde un archivo de backup JSON.
 * Uso: node scripts/restore-firestore.js <ruta-al-backup.json>
 *
 * ⚠️  ATENCIÓN: sobrescribe los documentos existentes con los del backup.
 *     Úsalo solo para hacer rollback.
 */

'use strict';

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'el-palomar-abed2-firebase-adminsdk-fbsvc-f2ea8d5793.json');

const backupFilePath = process.argv[2];
if (!backupFilePath) {
  console.error('❌  Uso: node scripts/restore-firestore.js <ruta-al-backup.json>');
  process.exit(1);
}

const resolvedBackupPath = path.resolve(backupFilePath);
if (!fs.existsSync(resolvedBackupPath)) {
  console.error('❌  No se encontró el archivo de backup:', resolvedBackupPath);
  process.exit(1);
}

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('❌  No se encontró el archivo de service account en:', SERVICE_ACCOUNT_PATH);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Firestore limita los batches a 500 operaciones
const BATCH_SIZE = 400;

async function restoreCollection(collectionName, docs) {
  const docEntries = Object.entries(docs);
  if (docEntries.length === 0) {
    console.log(`  ⚠️   ${collectionName}: 0 documentos, nada que restaurar`);
    return;
  }

  let written = 0;
  for (let i = 0; i < docEntries.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docEntries.slice(i, i + BATCH_SIZE);
    for (const [docId, data] of chunk) {
      const ref = db.collection(collectionName).doc(docId);
      batch.set(ref, data);
    }
    await batch.commit();
    written += chunk.length;
  }

  console.log(`  ✓  ${collectionName}: ${written} documentos restaurados`);
}

async function main() {
  const backup = JSON.parse(fs.readFileSync(resolvedBackupPath, 'utf8'));

  if (!backup._meta) {
    console.error('❌  El archivo no parece ser un backup válido (falta _meta).');
    process.exit(1);
  }

  console.log(`\n🔄  Restaurando backup creado el ${backup._meta.createdAt}`);
  console.log(`    Proyecto: ${backup._meta.projectId}`);
  console.log(`    Colecciones: ${backup._meta.collections.join(', ')}\n`);
  console.log('⚠️   Esto sobrescribirá los datos actuales. Ctrl+C para cancelar.\n');

  // Espera 3 segundos para dar tiempo a cancelar
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const allCols = [
    ...backup._meta.collections,
    ...(backup._meta.globalCollections || []),
  ];
  for (const col of allCols) {
    if (backup[col]) {
      await restoreCollection(col, backup[col]);
    } else {
      console.log(`  ⚠️   ${col}: no encontrado en el backup, omitido`);
    }
  }

  const totalDocs = [...backup._meta.collections, ...(backup._meta.globalCollections || [])].reduce(
    (sum, col) => sum + (backup[col] ? Object.keys(backup[col]).length : 0),
    0
  );
  console.log(`\n✅  Restauración completada: ${totalDocs} documentos escritos`);

  await admin.app().delete();
}

main().catch((err) => {
  console.error('❌  Error durante la restauración:', err);
  process.exit(1);
});
