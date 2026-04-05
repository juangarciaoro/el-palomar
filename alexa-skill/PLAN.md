# Plan de Migración: El Palomar + Alexa Skill

## Análisis de la arquitectura actual

```
Usuario → GitHub Pages (HTML/CSS/JS estático)
                  ↓
           Firebase Firestore (backend real)
           Firebase Auth (Google Sign-In)
```

### Conclusión clave: no es necesario migrar el hosting

GitHub Pages seguirá funcionando. El backend real ya es Firebase Firestore.
La Alexa Skill se conectará **directamente a Firestore** a través de una función Lambda,
sin pasar por el frontend web. No hay razón para pagar (ni migrar) el hosting.

La excepción sería si en el futuro quisieras añadir Account Linking de Alexa —
en ese caso se recomienda Firebase Hosting (también gratuito). Se explica en la Fase 4.

---

## Arquitectura objetivo

```
[Dispositivo Alexa]
       ↓  voz
[Alexa Skills Kit]  ←── interaction model (intents/slots en español)
       ↓  JSON request HTTPS
[AWS Lambda]  ←── función Node.js (capa gratuita: 1M req/mes)
       ↓  Firebase Admin SDK
[Firebase Firestore]  ←── colecciones: compra / tareas
       ↑
[App Web (GitHub Pages)] ←── sin cambios
[App Android (Capacitor)] ←── sin cambios
```

### Recursos gratuitos utilizados
| Servicio | Capa gratuita | Límite relevante |
|---|---|---|
| Amazon Alexa Developer | Siempre gratis | Sin límite de publicación privada |
| AWS Lambda | 1 000 000 req/mes | Para uso doméstico: ~100 req/día → 0% del límite |
| AWS Lambda compute | 400 000 GB-s/mes | Función de 128 MB + 3 s → ~1 000 000 invocaciones |
| Firebase Firestore | 50 000 lecturas/día · 20 000 escrituras/día | Uso doméstico: <100/día |
| Firebase Hosting (opcional) | 10 GB storage · 360 MB/día bandwidth | Para la web app estática |

---

## Esquema de Firebase Firestore (actual)

### Colección `compra`
```json
{
  "id": "item_1234_ab12",
  "name": "Leche",
  "units": 2,
  "cat": "🥛 Lácteos",
  "checked": false,
  "addedBy": "Juan",
  "createdAt": "<Timestamp>"
}
```

### Colección `tareas`
```json
{
  "id": "t_1234_ab12",
  "name": "Pasar la aspiradora",
  "cat": "limpiar",
  "prio": "media",
  "assignees": ["Papá"],
  "done": false,
  "addedBy": "Juan",
  "createdAt": "<Timestamp>"
}
```

---

## Fase 1 — Cuenta de servicio Firebase (backend seguro)

La Lambda necesita acceso de escritura a Firestore sin pasar por el navegador.
Para eso se usa una **Service Account** con credenciales de servidor.

### Pasos

1. Ve a [Firebase Console](https://console.firebase.google.com) → proyecto `el-palomar-abed2`
2. ⚙️ Configuración del proyecto → **Cuentas de servicio**
3. Pulsa **Generar nueva clave privada** → descarga `el-palomar-service-account.json`
4. **NO subas ese archivo a Git.** Añádelo a `.gitignore` si no está ya.
5. Guarda el contenido JSON —lo necesitarás como variable de entorno en Lambda.

---

## Fase 2 — Alexa Skill (Alexa Developer Console)

### 2.1 Crear cuenta

- [developer.amazon.com](https://developer.amazon.com) → cuenta gratuita
- (Puedes usar la misma cuenta de Amazon de compras)

### 2.2 Crear la Skill

1. Alexa Developer Console → **Create Skill**
2. Nombre: `El Palomar`
3. Idioma principal: **Spanish (ES)** — `es-ES`
4. Modelo: **Custom**
5. Método de hosting: **Alexa-hosted (Node.js)** ← NO usar esto, elegir **Provision your own**
   - Razón: necesitamos Firebase Admin SDK que requiere Lambda propia
6. Template: **Start from scratch**

### 2.3 Nombre de invocación

En **Invocation Name**: `el palomar`

Frases para activar:
- *"Alexa, abre el palomar"*
- *"Alexa, dile a el palomar que añada leche"*

### 2.4 Modelo de interacción

Importa el archivo `models/es-ES.json` incluido en este repositorio.

Intents implementados:

| Intent | Ejemplos de utterance |
|---|---|
| `AddShoppingItemIntent` | "añade {producto} a la lista de la compra" |
| `RemoveShoppingItemIntent` | "elimina {producto} de la lista" |
| `ListShoppingIntent` | "qué hay en la lista de la compra" |
| `AddTaskIntent` | "añade la tarea {tarea}" |
| `RemoveTaskIntent` | "marca como hecha la tarea {tarea}" |
| `ListTasksIntent` | "qué tareas tenemos pendientes" |

Slot types usados: `AMAZON.SearchQuery` (captura texto libre, buen para nombres propios
como "fresas", "pasar la aspiradora del salón", etc.)

### 2.5 Endpoint

- Tipo: **AWS Lambda ARN**
- El ARN se obtiene en la Fase 3 y se pega aquí.

---

## Fase 3 — AWS Lambda

### 3.1 Crear cuenta AWS

- [aws.amazon.com](https://aws.amazon.com) → cuenta gratuita
- Requiere tarjeta de crédito para verificar identidad, pero la capa gratuita no cobra nada.

### 3.2 Crear la función Lambda

1. AWS Console → **Lambda** → **Create function**
2. **Author from scratch**
3. Function name: `el-palomar-alexa`
4. Runtime: **Node.js 20.x**
5. Architecture: **x86_64**
6. Execution role: **Create a new role with basic Lambda permissions**
7. Pulsa **Create function**

### 3.3 Añadir trigger Alexa

1. En la función → **Add trigger** → **Alexa Skills Kit**
2. Copia el **Skill ID** desde Alexa Developer Console
   (está en: Build → Endpoint → tu Skill ID, formato `amzn1.ask.skill.xxxxxx`)
3. Pega el Skill ID en el campo "Skill ID verification" → **Add**

### 3.4 Variables de entorno

En Lambda → **Configuration** → **Environment variables**:

| Clave | Valor |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Contenido JSON completo del archivo de Fase 1 (en una sola línea) |
| `FIREBASE_PROJECT_ID` | `el-palomar-abed2` |

Para convertir el JSON a una línea:
```bash
# En la terminal:
python -c "import json,sys; print(json.dumps(json.load(open('el-palomar-service-account.json'))))"
```

### 3.5 Subir el código

```bash
cd alexa-skill/lambda
npm install
# Windows: usa PowerShell
Compress-Archive -Path * -DestinationPath ../deployment.zip -Force
```

En Lambda → **Code** → **Upload from** → **.zip file** → sube `deployment.zip`

Handler: `index.handler` (ya está configurado por defecto)

### 3.6 Configuración de la función

- Memory: **128 MB** (suficiente, mínimo disponible)
- Timeout: **7 segundos** (Alexa requiere respuesta en <8 s; Firestore tarda ~1-2 s)

### 3.7 Obtener el ARN

Aparece en la esquina superior derecha de la función:
```
arn:aws:lambda:eu-west-1:xxxxxxxxxxxx:function:el-palomar-alexa
```

Cópialo y pégalo en la Fase 2.5 (Endpoint de la Alexa Skill).

---

## Fase 4 — Pruebas

### 4.1 Test desde Lambda

Lambda → **Test** → crea un evento de prueba con este JSON:
```json
{
  "version": "1.0",
  "session": { "new": true, "sessionId": "test" },
  "request": {
    "type": "LaunchRequest",
    "requestId": "test",
    "timestamp": "2024-01-01T00:00:00Z",
    "locale": "es-ES"
  }
}
```
Respuesta esperada: `"Bienvenido a El Palomar..."`

### 4.2 Test desde Alexa Developer Console

Alexa Console → **Test** → activa "Skill testing is enabled in: Development"

Pruebas de voz a texto:
- `"abre el palomar"` → respuesta de bienvenida
- `"añade leche a la lista de la compra"` → confirma añadido
- `"qué hay en la lista de la compra"` → lista los productos pendientes
- `"añade la tarea pasar la aspiradora"` → confirma tarea añadida
- `"qué tareas tenemos pendientes"` → lista las tareas
- `"marca como hecha la tarea pasar la aspiradora"` → confirma completada

### 4.3 Verificación en Firebase Console

Firestore → colección `compra` → debe aparecer el producto añadido con `addedBy: "Alexa"`

---

## Fase 5 (Opcional) — Migrar el hosting a Firebase Hosting

Esto NO es necesario para que funcione Alexa, pero lo recomiendo como mejora futura:

### Ventajas respecto a GitHub Pages
- Mismo ecosistema (Firebase)
- Deploy automático con GitHub Actions
- CDN global de Google
- Soporte nativo para redirecciones y rewrites
- Gratis (10 GB storage, 360 MB/día)

### Pasos

1. Instala Firebase CLI:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init hosting
   ```
2. Configura `firebase.json`:
   ```json
   {
     "hosting": {
       "public": "www",
       "ignore": ["firebase.json", "**/.*"],
       "rewrites": [{ "source": "**", "destination": "/index.html" }]
     }
   }
   ```
3. Deploy:
   ```bash
   firebase deploy --only hosting
   ```
4. (Opcional) GitHub Actions para deploy automático:
   ```bash
   firebase init hosting:github
   ```

---

## Resumen de pasos ordenados

```
[ ] 1. Descargar service account JSON de Firebase Console
[ ] 2. npm install en alexa-skill/lambda/
[ ] 3. Comprimir lambda/ en deployment.zip
[ ] 4. Crear cuenta Amazon Developer
[ ] 5. Crear Skill en Alexa Developer Console (idioma es-ES)
[ ] 6. Importar models/es-ES.json al interaction model
[ ] 7. Crear cuenta AWS (si no tienes)
[ ] 8. Crear función Lambda el-palomar-alexa (Node.js 20.x)
[ ] 9. Añadir trigger "Alexa Skills Kit" con el Skill ID
[ ] 10. Configurar variables de entorno en Lambda
[ ] 11. Subir deployment.zip a Lambda
[ ] 12. Copiar ARN de Lambda → pegarlo en el Endpoint de la Skill
[ ] 13. Guardar y publicar el Interaction Model en Alexa Console
[ ] 14. Activar el modo Test en Alexa Console
[ ] 15. Probar con "abre el palomar" en el simulador o en un Echo real
```
