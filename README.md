# Balderdash

Juego web multijugador tipo Balderdash (el juego del diccionario) para jugar entre
amigos, cada uno desde su celular.

Sale una palabra rara en español, todos escriben una definición inventada, se mezclan
con la verdadera y todos votan cuál creen que es la real.

- **+2** por cada vez que votaste la definición verdadera
- **+1** por cada jugador que cayó en una definición tuya

Al terminar, el host puede arrancar otra partida con el mismo código: siguen los
mismos jugadores, se borra el puntaje y vuelven a estar disponibles todas las
palabras.

React + TypeScript + Vite, Firebase Realtime Database, sin backend propio. El sitio
es 100% estático.

---

## Probarlo sin crear nada

La forma más rápida: el emulador de Firebase, sin tocar ningún servicio.

```bash
npm install
```

En una terminal, el emulador:

```bash
npm run emulador
```

En otra, la app apuntando al emulador:

```bash
npm run dev:emulador
```

Para jugar con varios jugadores hacen falta sesiones separadas, porque el UID anónimo
se guarda por origen. Una ventana de incógnito alcanza; o abrí la app en `localhost` y
en `127.0.0.1`, que para el navegador son dos orígenes distintos.

El estado de la base se ve en <http://127.0.0.1:4000/database>.

**Si el emulador no arranca:** `firebase-tools` necesita Java 21 o superior. Si tu
`java` del PATH es más viejo:

```bash
brew install openjdk
PATH="/opt/homebrew/opt/openjdk/bin:$PATH" npm run emulador
```

---

## Crear el proyecto en Firebase

### 1. El proyecto

<https://console.firebase.google.com> → **Agregar proyecto**. Google Analytics no hace
falta.

### 2. La base de datos

**Compilación → Realtime Database → Crear base de datos.**

- Elegí la región más cercana.
- Cuando pregunte por las reglas, elegí **modo bloqueado**. Las de verdad se cargan en
  el paso 5; no dejes el modo de prueba ni por un rato.

Anotá la URL que te queda arriba de la base, es el `VITE_FIREBASE_DATABASE_URL`. Ojo
que el formato cambia según la región:

- `us-central1` → `https://<proyecto>-default-rtdb.firebaseio.com`
- cualquier otra → `https://<proyecto>-default-rtdb.<region>.firebasedatabase.app`

### 3. El acceso anónimo

**Compilación → Authentication → Comenzar → Anónimo → Habilitar.**

Sin esto la app arranca y muestra el error correspondiente: cada jugador necesita un
UID estable, y es lo único que usa de Authentication.

### 4. La configuración de la app

**Configuración del proyecto → Tus apps → Web (`</>`)** → registrala. Copiá los valores
del `firebaseConfig` que te muestra:

```bash
cp .env.example .env
```

y completá `.env`. Estos valores son públicos por diseño (viajan en el bundle de
cualquier app web de Firebase): lo que protege la base son las reglas, no estas claves.

### 5. Las reglas de seguridad

Están en [`database.rules.json`](database.rules.json). Dos formas de cargarlas:

```bash
npx firebase login
npx firebase deploy --only database --project <tu-proyecto>
```

O a mano: **Realtime Database → Reglas**, pegar el contenido del archivo y publicar.

Para confirmar que quedaron bien, la consola tiene el **Simulador de reglas** al lado
del editor. O corré la batería completa contra el emulador (ver *Pruebas*).

### 6. Probar en local

```bash
npm run dev
```

---

## Deployar en Netlify

### 1. Conectar el repo

<https://app.netlify.com> → **Add new site → Import an existing project** → elegí el
repositorio.

El build ya está configurado en [`netlify.toml`](netlify.toml) (`npm run build` →
`dist`), así que no hace falta tocar nada en esa pantalla.

### 2. Las variables de entorno

**Site configuration → Environment variables.** Cargá las cinco, con los mismos valores
de tu `.env`:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_DATABASE_URL
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
```

No cargues `VITE_USAR_EMULADOR`, o dejala en `false`. Si falta alguna, el sitio no
queda en blanco: muestra cuál falta.

### 3. Autorizar el dominio en Firebase

**Este es el paso que se olvida siempre.** En Firebase: **Authentication → Settings →
Dominios autorizados → Agregar dominio**, y poné el dominio que te dio Netlify
(`algo.netlify.app`, más tu dominio propio si le ponés uno).

Sin esto el sitio carga pero nadie puede entrar: el login anónimo falla con
`auth/unauthorized-domain`.

### 4. Deploy

Netlify buildea solo con cada push. Abrí el sitio, creá una sala y probá entrar desde
el celular con el código.

---

## Pruebas

```bash
npm test              # lógica pura: códigos, normalización, barajado, puntaje
npm run test:reglas   # reglas de seguridad, con el emulador prendido
```

`src/logica/` no importa nada de Firebase, así que se testea sin emulador ni mocks.
Ahí viven las cuatro cosas donde un bug pasa desapercibido y arruina la partida: el
barajado (distinto por jugador, pero igual entre recargas), la normalización (empareja
el estilo de tipeo para que la definición real no cante), la selección de palabra
(nunca repetir en una partida) y el puntaje.

[`pruebas/reglas.mjs`](pruebas/reglas.mjs) corre cada invariante de las reglas con un
caso que tiene que pasar y uno que tiene que ser rechazado: espiar definiciones ajenas,
votarse a uno mismo, escribir puntajes, entrar a una partida empezada, cambiar el voto,
leer el secreto antes del reveal. Una regla nueva sin su caso ahí es una regla que no
sabemos si funciona.

---

## Cómo está armado

```
src/
├── logica/      funciones puras, sin Firebase → se testean solas
├── servicios/   la única capa que toca la base
├── hooks/       suscripciones y estado de React
├── pantallas/   una por fase del juego
└── componentes/
```

Las pantallas nunca importan `firebase/database`: hablan con `servicios/` y `hooks/`.

El estado de cada sala está partido en tres por sensibilidad, porque en Realtime
Database los permisos **cascadean hacia abajo** (si un nodo concede lectura, todo lo
que cuelga queda legible y los hijos no lo pueden revocar):

- `publico/` — lo lee cualquier jugador de la sala, con un solo listener
- `privado/` — definiciones, votos y "cuál de las opciones es la mía": solo su dueño
- `secreto/` — el mapa de quién escribió cada opción, legible recién al revelar

El diseño completo, con el porqué de cada decisión, está en
[`docs/superpowers/specs`](docs/superpowers/specs/2026-09-19-balderdash-web-design.md).

---

## Cómo se cuenta el puntaje

El puntaje no se guarda en ningún lado: se deriva del historial de la partida cada vez
que se muestra. Por eso la regla de `puntaje` es `.validate: false` — nadie puede
escribirlo, ni siquiera el host — y por eso recargar la página no te hace perder nada.

---

## Ampliar la lista de palabras

Hoy hay **303 palabras** cargadas, que son 20 partidas de 15 rondas sin repetir una
sola. La lista curada vive en
[`herramientas/palabras-curadas.json`](herramientas/palabras-curadas.json) y de ahí
se exporta `src/data/palabras.ts`.

### Unas pocas, a mano

Agregá objetos a `PALABRAS` en [`src/data/palabras.ts`](src/data/palabras.ts):

```ts
{ id: 'cazcarria', palabra: 'cazcarria', definicion: 'el barro que se te pega...' }
```

El `id` tiene que ser único y conviene no cambiarlo después, porque queda guardado en
el historial de las partidas jugadas.

Escribí las definiciones en lenguaje llano, como las escribiría un jugador. Si suenan a
diccionario de verdad, se distinguen solas — y ese es justamente el error que arruina
la ronda.

### Muchas, con el generador

[`herramientas/generar_palabras.py`](herramientas/generar_palabras.py) arma la lista
cruzando el volcado de Wiktionary con una lista de frecuencia de uso, para quedarse
solo con palabras que casi nadie conoce. Solo usa la stdlib: no instala nada ni llama
a ninguna API.

Los dos insumos se bajan a mano una vez (están linkeados en la cabecera del script).
Después:

```bash
python3 herramientas/generar_palabras.py filtrar --diccionario kaikki.org-dictionary-Spanish.jsonl --frecuencias es_full.txt --salida candidatos.csv
```

```bash
python3 herramientas/generar_palabras.py pendientes --csv candidatos.csv --cantidad 60 --salida tanda.json
```

`tanda.json` sale con las glosas en inglés y la consigna de cómo redactarlas. Quien
las escriba devuelve un JSON con `palabra`, `definicion`, `apta` y `motivo`, y eso
vuelve al CSV:

```bash
python3 herramientas/generar_palabras.py incorporar --csv candidatos.csv --respuestas tanda-resuelta.json
```

En el CSV, la columna `usar` es el veto manual y le gana a lo que haya dicho quien
redactó: `no` descarta una que venía marcada como apta, `si` rescata una descartada.
Cuando estés conforme:

```bash
python3 herramientas/generar_palabras.py exportar --csv candidatos.csv --salida src/data/palabras.ts
```

### Antes de dar una definición por buena

[`herramientas/verificar_palabras.py`](herramientas/verificar_palabras.py) contrasta
cada definición contra el Wikcionario en español. No decide nada: pone las dos al lado
para que alguien compare. Es lo que agarró que `algibe` iba con jota y que `condumio`
no es la comida del camino sino la que se come con pan.

```bash
python3 herramientas/verificar_palabras.py --entrada tanda.json --salida revisadas.csv --frecuencias es_full.txt
```

Avisa de tres cosas: palabras que no existen (casi siempre es un error de tipeo),
palabras demasiado comunes según el corpus de frecuencia, y cuáles conviene mirar
primero porque comparten pocas palabras con la definición de referencia.

Esa última señal es ruidosa y conviene saberlo: nuestras definiciones son coloquiales
a propósito y las del Wikcionario son formales, así que dos maneras correctas de decir
lo mismo pueden no compartir una sola palabra. Sirve para elegir por dónde empezar, no
para descartar sin leer.

El filtro de frecuencia también tiene su límite: el corpus es de subtítulos y
mayormente peninsular, así que marca `bochinche` como rara y deja pasar `relinchar`.
Es una señal, no un veredicto.

### Qué hace que una palabra no sirva

De unas 700 candidatas escritas a mano quedaron 303. Lo que más descarta, en orden:

1. **Es conocida.** El tope está en el puesto 100.000 del corpus de frecuencia. Entre
   los 40.000 que traía el script y ese número caen cosas como `armatoste` y
   `mamarracho`, que nadie tendría que adivinar.
2. **Es ambigua.** `escora` es antes el puntal del astillero que la inclinación del
   barco; `hez` en plural son los excrementos; `sorna` es parsimonia antes que burla.
   Dos acepciones fuertes no dan risa al revelar, dan discusión.
3. **La definición se delata.** Si contiene la raíz de la propia palabra, o si es
   mucho más corta que lo que escribe un jugador, canta sola. El exportador aborta en
   los dos casos.

### Cuántas rondas se pueden jugar

El máximo por partida es el menor entre la cantidad de palabras cargadas y
`MAX_RONDAS` (15, en [`src/logica/rondas.ts`](src/logica/rondas.ts)). El segundo tope
existe porque cada ronda son varios minutos: sin él, con 300 palabras el selector
ofrecería 300 opciones.

Si cambiás `MAX_RONDAS`, cambiá también el tope en `database.rules.json`. Hay un test
que falla si dejan de coincidir.

---

## Qué no protege este diseño

Sin backend hay tres cosas que no tienen arreglo, y conviene saberlas:

1. **El host ve todo.** Para armar el pool anónimo necesita leer quién escribió qué. Es
   un jugador con acceso privilegiado.
2. **Las definiciones reales viajan en el bundle**, porque están en `palabras.ts`.
   Cualquiera puede abrir DevTools y leerlas.
3. **El historial lo escribe el host**, así que podría escribir uno falso. Las reglas
   validan la forma, no la verdad.

Para un juego entre amigos alcanza. Si en algún momento molesta, la solución es mover
esas tres cosas a Cloud Functions, a costa del plan Blaze.

Dos cosas más, menores:

- **Las salas no se borran.** Nadie tiene permiso para eliminarlas, así que se van
  acumulando. Cada partida pesa unos pocos KB contra el 1 GB del plan gratuito, o sea
  que hay margen de sobra; si algún día molesta, se limpian desde la consola de
  Firebase.
- **El código de sala es adivinable.** Son 4 letras: 456.976 combinaciones. Alguien
  podría entrar a una sala ajena probando códigos. Para jugar entre amigos no es un
  problema real.
