#!/usr/bin/env node
/**
 * migrate-to-hogares.js
 *
 * Crea el hogar "El Palomar" en Firestore y migra todos los datos existentes
 * de las colecciones raíz a hogares/{hogarId}/...
 *
 * COLECCIONES MIGRADAS: compra, comidas, tareas, recetas, productos, categorias, recordatorios
 * COLECCIONES NO MIGRADAS:
 *   - users (permanece en raíz; se le añade el campo activeHogarId)
 *   - productos-temporada (colección global/horizontal, compartida entre hogares)
 *
 * Uso: node scripts/migrate-to-hogares.js
 *      node scripts/migrate-to-hogares.js --dry-run   (solo muestra lo que haría, sin escribir)
 *
 * ⚠️  Ejecutar solo UNA vez. Verifica el backup antes de continuar.
 */

'use strict';

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 400;

// Google Calendar ID del hogar El Palomar (hardcodeado desde config.js original)
const CALENDAR_ID = 'ovvtdfmk9lq9pqn2n3sl7cdtso@group.calendar.google.com';

const COLLECTIONS_TO_MIGRATE = [
  'compra',
  'comidas',
  'tareas',
  'recetas',
  'productos',
  'categorias',
  'recordatorios',
];

// ─── Init Firebase ─────────────────────────────────────────────────────────────
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'el-palomar-abed2-firebase-adminsdk-fbsvc-f2ea8d5793.json');
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('❌  No se encontró el archivo de service account:', SERVICE_ACCOUNT_PATH);
  process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ─── Helpers ───────────────────────────────────────────────────────────────────
async function commitBatch(batch) {
  if (!DRY_RUN) await batch.commit();
}

async function migrarColeccion(hogarId, collectionName) {
  const snap = await db.collection(collectionName).get();
  if (snap.empty) {
    console.log(`  ⚪  ${collectionName}: vacía, omitida`);
    return 0;
  }

  let written = 0;
  const entries = [];
  snap.forEach(doc => entries.push({ id: doc.id, data: doc.data() }));

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = entries.slice(i, i + BATCH_SIZE);
    for (const { id, data } of chunk) {
      const ref = db.collection('hogares').doc(hogarId)
        .collection(collectionName).doc(id);
      batch.set(ref, data);
    }
    await commitBatch(batch);
    written += chunk.length;
  }

  console.log(`  ✓  ${collectionName}: ${written} documentos migrados`);
  return written;
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (DRY_RUN) {
    console.log('🔍  MODO DRY-RUN — no se escribirá nada en Firestore\n');
  }

  // 1. Comprobar que no existe ya un hogar "El Palomar"
  const hogaresSnap = await db.collection('hogares').get();
  if (!hogaresSnap.empty) {
    console.error('❌  Ya existe al menos un documento en la colección "hogares".');
    console.error('    La migración solo debe ejecutarse una vez. Abortando.');
    process.exit(1);
  }

  // 2. Leer usuarios existentes
  const usersSnap = await db.collection('users').get();
  if (usersSnap.empty) {
    console.error('❌  No se encontraron usuarios en la colección "users". Abortando.');
    process.exit(1);
  }

  const users = [];
  usersSnap.forEach(doc => users.push({ uid: doc.id, ...doc.data() }));
  console.log(`👥  Usuarios encontrados: ${users.map(u => u.displayName || u.uid).join(', ')}`);

  // El primer usuario (por orden de creación) será el propietario (admin)
  // Todos los usuarios existentes se añaden como admins en la migración inicial.
  const ownerUid = users[0].uid;

  // 3. Crear el documento del hogar
  const hogarRef = db.collection('hogares').doc(); // ID auto-generado
  const hogarId = hogarRef.id;
  const hogarData = {
    nombre: 'El Palomar',
    ownerId: ownerUid,
    calendarId: CALENDAR_ID,
    createdAt: FieldValue.serverTimestamp(),
  };

  console.log(`\n🏠  Creando hogar "El Palomar" con ID: ${hogarId}`);
  if (!DRY_RUN) await hogarRef.set(hogarData);

  // 4. Guardar el hogarId en un archivo para usarlo en Fase 5 (Alexa)
  const hogarIdPath = path.join(__dirname, '..', 'EL_PALOMAR_HOGAR_ID.txt');
  if (!DRY_RUN) {
    fs.writeFileSync(hogarIdPath, hogarId, 'utf8');
    console.log(`💾  hogarId guardado en: ${hogarIdPath}`);
  } else {
    console.log(`💾  [dry-run] Se guardaría hogarId en: ${hogarIdPath}`);
  }

  // 5. Crear subcollection members — todos los usuarios existentes como "admin"
  console.log('\n👥  Añadiendo miembros al hogar...');
  const membersBatch = db.batch();
  for (const user of users) {
    const memberRef = db.collection('hogares').doc(hogarId)
      .collection('members').doc(user.uid);
    membersBatch.set(memberRef, {
      role: 'admin',
      joinedAt: FieldValue.serverTimestamp(),
    });
    console.log(`  ✓  ${user.displayName || user.uid} → admin`);
  }
  await commitBatch(membersBatch);

  // 6. Migrar colecciones de datos
  console.log('\n📦  Migrando colecciones de datos...');
  let totalDocs = 0;
  for (const col of COLLECTIONS_TO_MIGRATE) {
    totalDocs += await migrarColeccion(hogarId, col);
  }

  // 7. Actualizar cada usuario con activeHogarId
  console.log('\n👤  Actualizando usuarios con activeHogarId...');
  const usersBatch = db.batch();
  for (const user of users) {
    const userRef = db.collection('users').doc(user.uid);
    usersBatch.update(userRef, { activeHogarId: hogarId });
    console.log(`  ✓  ${user.displayName || user.uid}`);
  }
  await commitBatch(usersBatch);

  // ─── Resumen ──────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  if (DRY_RUN) {
    console.log('🔍  DRY-RUN completado. Ningún dato ha sido modificado.');
  } else {
    console.log('✅  Migración completada.');
    console.log(`   Hogar creado:     El Palomar (${hogarId})`);
    console.log(`   Miembros:         ${users.length} (todos como admin)`);
    console.log(`   Documentos:       ${totalDocs} migrados a hogares/${hogarId}/`);
    console.log('\n📋  Próximos pasos:');
    console.log('   1. Comprueba en la consola de Firebase que los datos están bajo hogares/');
    console.log('   2. Aplica las Security Rules desde firestore.rules en la consola de Firebase');
    console.log(`   3. Apunta el ID "${hogarId}" en la Fase 5 (Alexa)`);
  }
  console.log('─'.repeat(60));

  await admin.app().delete();
}

main().catch(err => {
  console.error('❌  Error durante la migración:', err);
  process.exit(1);
});
