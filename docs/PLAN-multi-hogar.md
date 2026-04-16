# Plan: Conversión Multi-Hogar

## Contexto

La aplicación **El Palomar** es actualmente un proyecto Firebase con datos compartidos a nivel de proyecto (sin aislamiento por hogar). El objetivo es convertirla en una plataforma multi-hogar donde cada hogar tiene datos completamente aislados, gestión de miembros e invitaciones por enlace.

---

## Decisiones de diseño

| Decisión | Elección |
|---|---|
| Invitaciones | Enlace compartible con token único (expiración 48h) |
| Roles | Admin (creador) vs. Miembro |
| Multi-hogar | Un usuario puede pertenecer a varios hogares y alternar |
| Datos existentes | Migrar como hogar inicial "El Palomar" |
| Alexa | Compatibilidad mantenida: hardcodear el `hogarId` de El Palomar |
| Google Calendar | Cada hogar configura su propio Calendar ID desde ajustes |

---

## Estructura Firestore

### Actual (plana, sin aislamiento)
```
/compra/{id}
/comidas/{id}
/tareas/{id}
/recetas/{id}
/productos/{id}
/categorias/{id}
/recordatorios/{id}
/users/{uid}
```

### Global (compartida entre todos los hogares, permanece en la raíz)
```
/productos-temporada/{id}   ← catálogo de referencia, NO se migra por hogar
```

### Nueva (por hogar)
```
hogares/{hogarId}/
  nombre: string
  ownerId: string
  calendarId: string (opcional)
  createdAt: timestamp

hogares/{hogarId}/members/{uid}/
  role: "admin" | "member"
  joinedAt: timestamp

hogares/{hogarId}/invitaciones/{token}/
  createdBy: string
  createdAt: timestamp
  expiresAt: timestamp  (48h)
  used: boolean

hogares/{hogarId}/compra/{id}
hogares/{hogarId}/comidas/{id}
hogares/{hogarId}/tareas/{id}
hogares/{hogarId}/recetas/{id}
hogares/{hogarId}/productos/{id}
hogares/{hogarId}/categorias/{id}
hogares/{hogarId}/recordatorios/{id}

users/{uid}/
  ...campos actuales...
  activeHogarId: string
```

---

## Fases de implementación

### Fase 0 — Backup y rollback *(antes de tocar nada)*

| Paso | Descripción |
|---|---|
| 0a | Crear `scripts/backup-firestore.js`: usa el Admin SDK con el service account existente para leer las 8 colecciones raíz y volcar a `backup-YYYY-MM-DD.json` |
| 0b | Crear `scripts/restore-firestore.js`: lee el JSON de backup y reescribe todos los docs en las colecciones raíz originales (rollback) |
| 0c | Ejecutar el backup y verificar que el JSON contiene datos |
| 0d | Guardar el archivo de backup **fuera del repositorio** (contiene datos personales) |

---

### Fase 1 — Migración de datos y seguridad

| Paso | Descripción | Dependencias |
|---|---|---|
| 1 | Crear `scripts/migrate-to-hogares.js`: leer colecciones raíz → crear doc hogar "El Palomar" → reescribir subcolecciones bajo `hogares/{EL_PALOMAR_ID}/...`. **Excluir `productos-temporada`** (colección global, no se migra) | Fase 0 completada |
| 2 | Actualizar Firestore Security Rules: lectura/escritura permitida solo si `request.auth.uid` existe en `hogares/{hogarId}/members` | Paso 1 |

---

### Fase 2 — Capa de datos multi-hogar

*Pasos independientes entre sí, todos dependen de Fase 1*

| Paso | Archivo | Cambio |
|---|---|---|
| 3 | `www/js/config.js` | Añadir `getActiveHogar()` / `setActiveHogar()` que leen/escriben `activeHogarId` en el perfil del usuario en Firestore |
| 4 | `www/js/data.js` | Cambiar **todas** las rutas de colección de `/compra`, `/tareas`, etc. a `hogares/{hogarId}/compra`, etc. usando el hogar activo |
| 5 | `www/js/auth.js` | Tras login, cargar `activeHogarId` del usuario. Si no tiene ningún hogar → redirigir al flujo "crear hogar" |

---

### Fase 3 — UI de gestión del hogar

*Depende de Fase 2*

| Paso | Descripción |
|---|---|
| 6 | Nueva vista `www/js/views/ajustes-hogar.js`: nombre del hogar (editable por admin), lista de miembros, Calendar ID, zona de invitaciones |
| 7 | Selector de hogar: menú para alternar entre hogares cuando el usuario pertenece a más de uno (actualiza `activeHogarId` y recarga datos) |
| 8 | Nombre dinámico: reemplazar literales `"El Palomar"` en `www/index.html` y `www/js/views/dashboard.js` por el nombre del hogar activo leído de Firestore |
| 9 | Flujo de onboarding: pantalla para crear un nuevo hogar (nombre) cuando el usuario no pertenece a ninguno |

---

### Fase 4 — Sistema de invitaciones

*Depende de Fase 2, puede desarrollarse en paralelo con Fase 3*

| Paso | Descripción |
|---|---|
| 10 | Generar enlace: en Ajustes del hogar (solo admin), crear doc en `invitaciones/{UUID}` con expiración 48h y mostrar URL `https://app.url?invite=TOKEN` con botón "Copiar" |
| 11 | Aceptar invitación: en `auth.js`, detectar `?invite=TOKEN` en la URL al abrir la app, autenticar al usuario, validar token (no expirado, no usado), añadir a `members` con role `"member"` y marcar `used: true` |
| 12 | UI admin: listar miembros activos con opción de expulsar, listar invitaciones pendientes con opción de revocar |

---

### Fase 5 — Compatibilidad Alexa

*Independiente, puede hacerse en cualquier momento*

| Paso | Archivo | Cambio |
|---|---|---|
| 13 | `alexa-skill/lambda/index.js` | Hardcodear el `hogarId` del hogar "El Palomar" (obtenido tras la migración) para leer de `hogares/{EL_PALOMAR_ID}/compra` en lugar de la colección raíz `/compra` |

---

### Fase 6 — Google Calendar por hogar

*Depende de Fase 3 (el campo `calendarId` se guarda en el documento del hogar)*

| Paso | Archivo | Cambio |
|---|---|---|
| 14 | `www/js/views/calendario.js` | Leer `calendarId` del documento del hogar activo en lugar de la constante `GOOGLE_CALENDAR_ID` hardcodeada en `config.js` |

---

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `www/js/config.js` | Helpers `getActiveHogar` / `setActiveHogar` |
| `www/js/auth.js` | Flujo post-login, aceptación de invitaciones, onboarding |
| `www/js/data.js` | Rutas de todas las colecciones por hogar (cambio más extenso). `getProductosTemporada` sigue leyendo de `/productos-temporada` (raíz global) |
| `www/js/views/dashboard.js` | Nombre dinámico del hogar |
| `www/index.html` | Reemplazar literales "El Palomar" |
| `www/manifest.json` | Nombre de app dinámico (limitado en PWA) |
| `www/js/views/calendario.js` | `calendarId` desde el hogar |
| `www/js/views/ajustes-hogar.js` | **Archivo nuevo** |
| `alexa-skill/lambda/index.js` | Hardcodear `hogarId` de El Palomar |
| `scripts/backup-firestore.js` | **Archivo nuevo** |
| `scripts/migrate-to-hogares.js` | **Archivo nuevo** |
| `scripts/restore-firestore.js` | **Archivo nuevo** |
| Firebase Console (manual) | Actualizar Security Rules |

---

## Plan de verificación

1. **Backup**: verificar que `backup-YYYY-MM-DD.json` contiene datos de todas las colecciones antes de migrar
2. **Migración**: comprobar en la consola de Firebase que todos los documentos existen bajo `hogares/{id}/`
3. **Security Rules**: probar que un usuario sin membership no puede leer datos de otro hogar
4. **E2E creación**: usuario crea hogar → nombre aparece en la app en lugar de "El Palomar"
5. **E2E invitación**: generar enlace → abrirlo en otro dispositivo → aceptar → ambos usuarios ven los mismos datos en tiempo real
6. **Multi-hogar**: usuario pertenece a dos hogares, alterna entre ellos y los datos cambian correctamente
7. **Alexa**: "añade leche a la lista de la compra" sigue funcionando en El Palomar tras la migración
8. **Rollback**: ejecutar `restore-firestore.js` y verificar que los datos originales se restauran en las colecciones raíz

---

## Fuera del alcance

- Adaptación completa de Alexa al modelo multi-hogar (solo compatibilidad con El Palomar)
- Nueva build del APK de Android
- Sistema de notificaciones push para invitaciones
- Roles con permisos granulares más allá de admin/miembro
