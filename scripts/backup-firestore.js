#!/usr/bin/env node
/**
 * backup-firestore.js
 * Lee todas las colecciones raíz de Firestore y las vuelca a un archivo JSON.
 * Uso: node scripts/backup-firestore.js
 * Genera: backup-YYYY-MM-DD.json en la raíz del proyecto
 *
 * ⚠️  El archivo generado puede contener datos personales.
 *     Guárdalo fuera del repositorio.
 */

'use strict';

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'el-palomar-abed2-firebase-adminsdk-fbsvc-f2ea8d5793.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('❌  No se encontró el archivo de service account en:', SERVICE_ACCOUNT_PATH);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Colecciones que se migrarán a hogares/{hogarId}/...
const COLLECTIONS = [
  'compra',
  'comidas',
  'tareas',
  'recetas',
  'productos',
  'categorias',
  'recordatorios',
  'users',
];

// Colecciones globales/horizontales: compartidas entre todos los hogares, permanecen en la raíz
const GLOBAL_COLLECTIONS = [
  'productos-temporada',
];

async function backupCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  const docs = {};
  snapshot.forEach((doc) => {
    docs[doc.id] = doc.data();
  });
  console.log(`  ✓  ${collectionName}: ${snapshot.size} documentos`);
  return docs;
}

async function main() {
  console.log('🔄  Iniciando backup de Firestore...\n');

  const allCollections = [...COLLECTIONS, ...GLOBAL_COLLECTIONS];
  const backup = {
    _meta: {
      createdAt: new Date().toISOString(),
      projectId: serviceAccount.project_id,
      collections: COLLECTIONS,
      globalCollections: GLOBAL_COLLECTIONS,
    },
  };

  console.log('Colecciones por hogar:');
  for (const col of COLLECTIONS) {
    backup[col] = await backupCollection(col);
  }

  console.log('\nColecciones globales (compartidas entre hogares):');
  for (const col of GLOBAL_COLLECTIONS) {
    backup[col] = await backupCollection(col);
  }

  const date = new Date().toISOString().slice(0, 10);
  const outputPath = path.join(__dirname, '..', `backup-${date}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(backup, null, 2), 'utf8');

  const totalDocs = [...COLLECTIONS, ...GLOBAL_COLLECTIONS].reduce((sum, col) => sum + Object.keys(backup[col]).length, 0);
  console.log(`\n✅  Backup completado: ${totalDocs} documentos totales`);
  console.log(`📁  Archivo guardado en: ${outputPath}`);
  console.log('\n⚠️   Mueve el archivo fuera del repositorio. Puede contener datos personales.');

  await admin.app().delete();
}

main().catch((err) => {
  console.error('❌  Error durante el backup:', err);
  process.exit(1);
});
