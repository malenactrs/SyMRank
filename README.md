# 🎓 ProfeRank — Guía de configuración

## Archivos del proyecto
```
index.html    → Estructura HTML de la SPA
styles.css    → Estilos con tema claro/oscuro
app.js        → Lógica + integración Firebase
```

---

## 1. Crear proyecto Firebase

1. Ir a https://console.firebase.google.com
2. **Crear nuevo proyecto** (ej: `proferank`)
3. Ir a **Firestore Database** → Crear base de datos → Modo test
4. Ir a **Configuración del proyecto** → "Tu app" → Registrar app web
5. Copiar el `firebaseConfig` que te muestra

---

## 2. Pegar tu config en app.js

Abrí `app.js` y reemplazá el bloque al inicio:

```js
const firebaseConfig = {
  apiKey:            "TU_API_KEY",
  authDomain:        "TU_PROYECTO.firebaseapp.com",
  projectId:         "TU_PROJECT_ID",
  storageBucket:     "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId:             "TU_APP_ID"
};
```

---

## 3. Reglas Firestore (modo test)

En la consola de Firebase → Firestore → Reglas:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

---

## 4. Deploy en Netlify

### Opción A — Drag & Drop
1. Ir a https://netlify.com → Log in
2. Arrastrar la carpeta del proyecto al panel de Netlify
3. ¡Listo! Te da una URL pública

### Opción B — GitHub + Netlify CI
1. Subir el proyecto a un repo de GitHub
2. En Netlify: **Add new site** → **Import from Git**
3. Conectar el repo
4. Build command: (vacío)
5. Publish directory: `.` (raíz)
6. Deploy site

---

## 5. Estructura Firestore

**Colección:** `opiniones`

| Campo       | Tipo      | Descripción                        |
|-------------|-----------|-----------------------------------|
| profesor    | string    | Nombre del profesor               |
| materia     | string    | Nombre de la materia              |
| cuatrimestre| string    | "Primer" / "Segundo" / "Tercero"  |
| anio        | number    | Año (ej: 2024)                    |
| diaHorario  | number    | Código día/horario (ej: 1300)     |
| descripcion | string    | Texto de la opinión               |
| puntuacion  | number    | 1 a 5                             |
| fecha       | timestamp | Generado por Firebase             |

**Código diaHorario:** `(día × 1000) + horario`
- Lunes=1, Martes=2, Miércoles=3, Jueves=4, Viernes=5, Sábado=6
- Mañana=300, Tarde=600, Noche=900

**Ejemplos:** Lunes mañana=1300 · Martes noche=2900 · Sábado tarde=6600

---

## 6. Temas

El botón deslizante en el header cambia entre:
- ☀️ **Claro**: verde vivo (`#22c55e`) + blanco
- 🌙 **Oscuro**: verde oscuro + gris (`#1a1f1a`)

La preferencia se guarda en `localStorage`.
