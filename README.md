# Balderdash

Juego web multijugador tipo Balderdash (el juego del diccionario) para jugar entre
amigos, cada uno desde su celular.

Sale una palabra rara en español, todos escriben una definición inventada, se mezclan
con la verdadera y todos votan cuál creen que es la real.

- **+1** por cada jugador que votó tu definición falsa
- **+2** si votaste la definición correcta

React + TypeScript + Vite, Firebase Realtime Database, sin backend propio. El sitio
es 100% estático.

> **Estado: etapa 3 de 4.** El juego está completo: salas, lobby, presencia,
> reconexión, ciclo de ronda (escribir → votar → revelar), puntaje y tabla final.
> Falta la etapa 4: los pasos para crear el proyecto en Firebase y deployar en
> Netlify.

## Desarrollo con el emulador

La forma más rápida de probar: no hace falta crear nada en Firebase.

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

Para probar con varios jugadores hacen falta sesiones separadas, porque el UID anónimo
se guarda por origen. Una ventana de incógnito alcanza; o abrí la misma app en
`localhost` y en `127.0.0.1`, que para el navegador son dos orígenes distintos.

El estado de la base se ve en <http://127.0.0.1:4000/database>.

### Si el emulador no arranca

`firebase-tools` necesita **Java 21 o superior**. Si tenés una versión vieja como
default:

```bash
brew install openjdk
PATH="/opt/homebrew/opt/openjdk/bin:$PATH" npm run emulador
```

## Pruebas

```bash
npm test              # lógica pura: códigos, normalización, barajado, puntaje
npm run test:reglas   # reglas de seguridad, con el emulador prendido
```

`src/logica/` no importa nada de Firebase, así que se testea sin emulador ni mocks.
Ahí viven las cuatro cosas donde un bug pasa desapercibido y arruina la partida:
el barajado (tiene que ser distinto por jugador pero igual entre recargas), la
normalización (empareja el estilo de tipeo para que la definición real no cante),
la selección de palabra (nunca repetir en una partida) y el puntaje.

`pruebas/reglas.mjs` corre cada invariante de `database.rules.json` con un caso que
tiene que pasar y uno que tiene que ser rechazado.

## Desarrollo contra un proyecto real de Firebase

```bash
cp .env.example .env    # completar con los datos del proyecto
npm run dev
```

Los pasos para crear el proyecto, activar el acceso anónimo, cargar las reglas y
deployar en Netlify están en la etapa 4.

## Cómo se cuenta el puntaje

- **+2** por cada vez que votaste la definición verdadera
- **+1** por cada jugador que cayó en una definición tuya

El puntaje no se guarda en ningún lado: se deriva del historial de la partida cada
vez que se muestra. Por eso la regla de `puntaje` es `.validate: false` — nadie
puede escribirlo, ni siquiera el host — y por eso recargar la página no te hace
perder nada.

## Ampliar la lista de palabras

Agregá objetos a `PALABRAS` en [`src/data/palabras.ts`](src/data/palabras.ts). El `id`
tiene que ser único y conviene no cambiarlo después, porque queda guardado en el
historial de las partidas jugadas.

El máximo de rondas de una partida es la cantidad de palabras cargadas.

## Qué no protege este diseño

Sin backend hay tres cosas que no tienen arreglo, y conviene saberlas:

1. **El host ve todo.** Para armar el pool anónimo de definiciones necesita leer quién
   escribió qué. Es un jugador con acceso privilegiado.
2. **Las definiciones reales viajan en el bundle**, porque están en `palabras.ts`.
   Cualquiera puede abrir DevTools y leerlas.
3. **El historial lo escribe el host**, así que podría escribir uno falso. Las reglas
   validan la forma, no la verdad.

Para un juego entre amigos alcanza. Si en algún momento molesta, la solución es mover
esas tres cosas a Cloud Functions, a costa del plan Blaze.

El diseño completo está en
[`docs/superpowers/specs`](docs/superpowers/specs/2026-09-19-balderdash-web-design.md).
