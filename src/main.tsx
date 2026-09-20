import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './estilos.css'

const contenedor = document.getElementById('root')
if (!contenedor) throw new Error('Falta el div#root en index.html')
const root = createRoot(contenedor)

/**
 * La app se importa en diferido a propósito: `firebase.ts` revienta al importarse
 * si falta el .env, y así ese error se muestra en pantalla en vez de dejar la
 * página en blanco.
 */
import('./App')
  .then(({ App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((error: Error) => {
    root.render(
      <div className="pantalla">
        <header className="tapa">
          <h1>No arranca</h1>
        </header>
        <p className="error">{error.message}</p>
      </div>,
    )
  })
