# Balderdash web — diseño

Fecha: 2026-09-19

## Qué es

Juego web multijugador tipo Balderdash (el juego del diccionario) para jugar entre
amigos, cada uno desde su celular. Sale una palabra rara en español, todos escriben
una definición inventada, se mezclan con la verdadera y todos votan cuál creen que
es la real.

Puntaje:

- +1 por cada jugador que votó tu definición falsa
- +2 si votaste la definición correcta

Se juega a N rondas (default 8) y al final se muestra la tabla.

## Stack y restricciones

- React + TypeScript + Vite. Sin framework de UI. CSS propio, mobile-first.
- Firebase Realtime Database para el estado compartido.
- Autenticación anónima de Firebase al arranque (UID estable por dispositivo).
- Sin backend propio: el sitio es 100% estático y se deploya en Netlify.
- Config de Firebase por variables de entorno `VITE_*`. `.env.example` commiteado,
  `.env` en `.gitignore`.
- Vitest para `src/logica/` (funciones puras) y un script de pruebas de reglas
  contra el emulador de Firebase.

## Decisiones tomadas

| Decisión | Elección |
| --- | --- |
| Puntaje | Derivado del historial. Nadie escribe `puntaje` nunca. |
| Definiciones reales | En `src/data/palabras.ts` (viajan al cliente). |
| Host caído | Partida pausada. Host fijo, sin traspaso. |
| Ubicación | `~/Documents/Personal/Repositories/balderdash` |

## Límites conocidos (sin backend no tienen arreglo)

1. **El host puede hacer trampa.** Necesita leer las definiciones y la autoría para
   armar el pool anónimo y para escribir el historial. Es un jugador con acceso
   privilegiado. Queda documentado en el README.
2. **Las definiciones reales viajan en el bundle.** Cualquier jugador puede abrir
   DevTools y buscar la palabra en el JS. Honor system.
3. **El historial lo escribe el host.** Un host malicioso podría escribir un
   historial falso y alterar la tabla. Las reglas validan la forma, no la verdad.

Estos tres puntos desaparecerían con Cloud Functions, a costa del plan Blaze y de
dejar de ser un proyecto puramente estático.

## Modelo de datos

Ajustado respecto del borrador original. Los cambios y su motivo están abajo.

```
salas/{codigo}                          # codigo: 4 letras mayúsculas
 publico/                               # un solo listener trae todo esto
  host: uid
  creadaEn: number                      # timestamp
  estado: "lobby" | "jugando" | "terminado"
  config:
    rondas: number                      # default 8
  jugadores/{uid}:
    nombre: string
    conectado: boolean
  usadas/{palabraId}: true              # palabras ya jugadas en esta partida
  ronda:
    numero: number                      # 1..config.rondas
    fase: "escribiendo" | "votando" | "revelando"
    palabraId: string
    palabra: string                     # denormalizado, para mostrar
    opciones/{opcionId}: { texto }      # pool anónimo, aparece en "votando"
    entregaron/{uid}: true
    votaron/{uid}: true
  historial/{numero}:                   # escrito por el host al revelar
    palabraId: string
    palabra: string
    opciones/{opcionId}: { texto, autor }   # autor: uid | "REAL"
    votos/{uid}: opcionId

 privado/                               # cada quien lee lo suyo; el host lee todo
  definiciones/{uid}: { texto }
  votos/{uid}: { opcionId }
  mias/{uid}: opcionId

 secreto/                               # legible recién en fase "revelando"
  autores/{opcionId}: uid | "REAL"
```

### Por qué `publico/` / `privado/` / `secreto/`

En RTDB los permisos **cascadean hacia abajo**: si un nodo concede `.read`, todo lo
que cuelga de él queda legible y los hijos no pueden revocarlo. Con las partes
privadas mezcladas adentro de `ronda`, `ronda` entera tenía que ser ilegible, y el
cliente necesitaba un listener separado por cada campo público (`numero`, `fase`,
`palabra`, `opciones`, `entregaron`, `votaron`…).

Separando por sensibilidad, todo el estado público entra con **un solo `onValue`**
sobre `salas/{codigo}/publico`, y lo privado queda en ramas con su propia regla.

### Cambio 1 — pool anónimo de opciones

El borrador guardaba las definiciones bajo `definiciones/{uid}` y las mostraba desde
ahí. Las reglas de RTDB no pueden entregar los valores ocultando las claves: cualquier
jugador que leyera ese nodo veía quién escribió qué.

Solución: al pasar de `escribiendo` a `votando`, el host publica `opciones/{opcionId}`
con `opcionId` aleatorio y sin autoría. La definición real es una opción más. El mapa
`opcionId → autor` va a `secreto/autores`, legible recién en `revelando`.

Efecto secundario bueno: la normalización de texto la aplica **una sola vez el host**
sobre todos los textos juntos, incluida la real, en vez de cada cliente por su cuenta.

### Cambio 2 — separar "ya actuó" de "qué hizo"

`votos/{uid}: { votadoUid }` con el valor `"REAL"` era legible por todos durante la
votación: el primero que votaba le regalaba la respuesta al resto.

Los votos ahora guardan un `opcionId` opaco y el nodo es privado. Para la UI de
"quiénes ya entregaron / ya votaron" hay dos nodos públicos que solo contienen `true`:
`entregaron/{uid}` y `votaron/{uid}`. El requisito de UX queda garantizado por las
reglas, no por la UI.

### Cambio 3 — sin campo `puntaje`

El requisito era que nadie escriba puntajes desde el cliente, pero no hay servidor que
los escriba. En vez de eso, `jugadores/{uid}` no tiene `puntaje` y la regla es
`"puntaje": { ".validate": false }`.

El host escribe `historial/{numero}` al pasar a `revelando`. Cada cliente calcula la
tabla con `calcularTabla(historial)`, una función pura. La reconexión conserva el
puntaje porque el puntaje no se guarda: se recalcula.

### Cambio 4 — `mias/{uid}`

Para bloquear el autovoto, cada jugador necesita saber cuál de las opciones es la
suya. Comparar textos es frágil (la normalización los altera, y dos jugadores pueden
escribir lo mismo). El host escribe `mias/{uid}: opcionId`, legible solo por ese uid.

Esto además permite que **las reglas** rechacen el autovoto, no solo la UI.

### Cambio 5 — `usadas`

Para que no salga dos veces la misma palabra en una partida.

## Transiciones (todas las hace el host, en un solo `update()` atómico)

**lobby → jugando**
Elige una palabra al azar entre las no usadas, escribe `ronda` con
`numero: 1, fase: "escribiendo"`, marca `usadas/{palabraId}`, `estado: "jugando"`.

**escribiendo → votando**
Lee `privado/definiciones`, normaliza todos los textos junto con la definición real,
genera un `opcionId` aleatorio por cada uno, y escribe en un update:
`ronda/opciones`, `privado/mias`, `secreto/autores`, `ronda/fase: "votando"`.

El botón del host se habilita cuando entregaron todos, pero puede forzar antes si
alguien se colgó. Quien no entregó no tiene opción en el pool; igual puede votar.

**votando → revelando**
Escribe `historial/{numero}` combinando `ronda/opciones`, `secreto/autores` y
`privado/votos`,
y `fase: "revelando"`.

**revelando → siguiente**
Si `numero < config.rondas`: reemplaza `ronda` completa por la siguiente (fase
`escribiendo`, palabra nueva) y limpia `secreto`.
Si no: `estado: "terminado"`.

## Cálculo del puntaje

Función pura sobre `historial`:

```
para cada ronda del historial:
  para cada (votante → opcionId) en ronda.votos:
    autor = ronda.opciones[opcionId].autor
    si autor === "REAL":         puntos[votante] += 2
    si no y autor !== votante:   puntos[autor]   += 1
```

El caso `autor === votante` no debería ocurrir (lo bloquean las reglas), pero la
función lo ignora igual por las dudas.

## Normalización de texto

Se aplica a todas las definiciones, incluida la real, en el mismo momento. Si no,
se nota cuál es cuál por el estilo de tipeo.

1. `trim()` y colapsar espacios internos múltiples
2. Si el texto está TODO EN MAYÚSCULAS, pasarlo a minúsculas
3. Primera letra en mayúscula
4. Sacar puntos y puntos suspensivos finales (`.`, `...`). Se conservan `?` y `!`
   porque sacarlos cambiaría el sentido.

## Barajado

Orden distinto para cada jugador, pero **determinístico**: semilla =
`hash(uid + palabraId)`. Con `Math.random()`, el que recarga la página ve las
opciones en otro orden y se pierde.

## Reconexión

`localStorage` guarda `{ codigo, nombre }`. Al arrancar:

1. Auth anónima (persistencia local → el UID sobrevive al reload).
2. Si hay `codigo` guardado, la sala existe y `jugadores/{uid}` existe → entra directo
   al estado en el que está la sala.
3. Si el uid no figura en la sala (storage borrado, otro dispositivo) → pantalla de
   inicio con el código precargado. Entra como jugador nuevo, sin el puntaje viejo.

Presencia: al conectar, `jugadores/{uid}/conectado = true` y un `onDisconnect()` que
lo pone en `false`, colgado de `.info/connected`.

## Reglas de seguridad

Invariantes que `database.rules.json` tiene que garantizar:

0. Nada es legible ni escribible sin `auth != null`. Con auth, son legibles las
   partes públicas de la sala: `host`, `estado`, `config`, `jugadores`, `historial`,
   `usadas` y los campos de `ronda` salvo `definiciones`, `votos` y `mias`.
1. La raíz es `".read": false, ".write": false`; los permisos se abren por rama.
2. `host` solo se puede escribir si no existía, y solo con el propio uid.
3. `estado`, `config` y `ronda/fase` solo los escribe el host.
4. `jugadores/{uid}` solo lo escribe ese uid. `nombre` string de 1..20 caracteres.
   `puntaje` rechazado por `.validate: false`.
5. `privado/definiciones/{uid}`: escribe solo ese uid, solo en fase `escribiendo`.
   Lee solo ese uid o el host.
6. `privado/votos/{uid}`: escribe solo ese uid, solo en fase `votando`, solo si no
   existía (el voto es final), y el `opcionId` tiene que existir en `ronda/opciones`
   y ser distinto de `privado/mias/{uid}`. Lee solo ese uid o el host.
7. `ronda/opciones`, `privado/mias`, `secreto`, `historial`, `usadas`: escribe solo
   el host.
8. `secreto`: lee cualquiera solo cuando `ronda/fase === "revelando"`. El host lee
   siempre (lo necesita para armar el historial si recargó la página).
9. `entregaron/{uid}` y `votaron/{uid}`: escribe solo ese uid, valor `true`.

Verificación: `pruebas/reglas.mjs` corre contra el emulador local (`npm run emulador`
y `npm run test:reglas`). Cada invariante de arriba tiene un caso que tiene que pasar
y uno que tiene que ser rechazado. Una regla sin su caso es una regla que no sabemos
si funciona.

## Estructura de archivos

```
balderdash/
├── .env.example  .gitignore  .npmrc  README.md
├── database.rules.json   firebase.json  .firebaserc   netlify.toml
├── pruebas/reglas.mjs           # reglas contra el emulador
├── index.html  package.json  tsconfig.json  vite.config.ts
└── src/
    ├── main.tsx  App.tsx  estilos.css
    ├── firebase.ts              # init + auth anónima + export db
    ├── tipos.ts                 # tipos del modelo de datos
    ├── data/palabras.ts
    ├── logica/                  # puro, sin Firebase → testeable
    │   ├── normalizar.ts
    │   ├── barajar.ts
    │   ├── puntaje.ts
    │   └── codigoSala.ts
    ├── servicios/               # única capa que toca RTDB
    │   ├── sala.ts              # crear, unirse, presencia, suscripción
    │   └── ronda.ts             # acciones del host + acciones del jugador
    ├── hooks/
    │   ├── useAuth.ts
    │   ├── useSala.ts
    │   └── useSesionLocal.ts
    ├── pantallas/
    │   ├── Inicio.tsx  Lobby.tsx
    │   ├── Escribiendo.tsx  Votando.tsx  Revelando.tsx
    │   └── Final.tsx
    └── componentes/
        ├── ListaJugadores.tsx
        └── Cargando.tsx
```

Regla de capas: las pantallas nunca importan `firebase/database`. Hablan con
`servicios/` y `hooks/`. `logica/` no importa nada de Firebase, por eso se testea sin
emulador ni mocks.

## Lista de palabras

`src/data/palabras.ts`, formato `{ id, palabra, definicion }`. Semilla de 10:
cazcarria, jeribeque, estafermo, guirigay, carantoña, gaznápiro, zurrapa, tolondro,
escolimoso, chafallo. La amplía el usuario después.

Si la partida pide más rondas que palabras disponibles, el lobby avisa y limita el
máximo de rondas a la cantidad de palabras.

## Etapas de implementación

1. **Scaffold + sala.** Vite, Firebase, auth anónima, crear/unirse con código de 4
   letras, lobby con presencia. Verificable con dos pestañas.
2. **Ciclo de ronda.** escribiendo → votando → revelando, pool anónimo, transiciones
   del host.
3. **Puntaje + final + reconexión.** Historial, tabla derivada, rehidratar desde
   localStorage.
4. **Reglas de seguridad + README + Netlify.**

## Qué queda afuera (YAGNI)

- Temporizadores por fase. El host avanza cuando quiere.
- Chat.
- Persistencia de partidas terminadas / historial entre partidas.
- Categorías o dificultad de palabras.
- Expulsar jugadores.
- Traspaso de host.
