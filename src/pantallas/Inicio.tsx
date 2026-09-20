import { useState } from 'react'
import { TOTAL_PALABRAS } from '../data/palabras'
import { esCodigoValido, normalizarCodigo } from '../logica/codigoSala'
import { crearSala, LARGO_MAX_NOMBRE, unirseASala } from '../servicios/sala'

const RONDAS_DEFAULT = 8

interface Props {
  uid: string
  nombreInicial: string
  codigoInicial: string
  aviso: string | null
  alEntrar: (codigo: string, nombre: string) => void
}

export function Inicio({ uid, nombreInicial, codigoInicial, aviso, alEntrar }: Props) {
  const [nombre, setNombre] = useState(nombreInicial)
  const [codigo, setCodigo] = useState(codigoInicial)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<'crear' | 'unirse' | null>(null)

  const nombreLimpio = nombre.trim()
  const nombreOk = nombreLimpio.length > 0

  async function conManejoDeError(que: 'crear' | 'unirse', accion: () => Promise<void>) {
    setError(null)
    setOcupado(que)
    try {
      await accion()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Algo salió mal. Probá de nuevo.')
    } finally {
      setOcupado(null)
    }
  }

  const alCrear = () =>
    conManejoDeError('crear', async () => {
      const nuevo = await crearSala({
        uid,
        nombre: nombreLimpio,
        rondas: Math.min(RONDAS_DEFAULT, TOTAL_PALABRAS),
      })
      alEntrar(nuevo, nombreLimpio)
    })

  const alUnirse = () =>
    conManejoDeError('unirse', async () => {
      await unirseASala({ codigo, uid, nombre: nombreLimpio })
      alEntrar(codigo, nombreLimpio)
    })

  return (
    <div className="pantalla">
      <header className="tapa">
        <h1>Balderdash</h1>
        <p className="atenuado">
          Inventá definiciones. Hacé que te crean. Descubrí la verdadera.
        </p>
      </header>

      {aviso && <p className="aviso">{aviso}</p>}

      <label className="campo">
        <span>Tu nombre</span>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value.slice(0, LARGO_MAX_NOMBRE))}
          placeholder="Cómo te ven los demás"
          autoComplete="nickname"
          maxLength={LARGO_MAX_NOMBRE}
        />
      </label>

      <section className="bloque">
        <button
          className="primario"
          onClick={alCrear}
          disabled={!nombreOk || ocupado !== null}
        >
          {ocupado === 'crear' ? 'Creando…' : 'Crear sala nueva'}
        </button>
      </section>

      <div className="separador">
        <span>o entrá a una</span>
      </div>

      <section className="bloque">
        <label className="campo">
          <span>Código de la sala</span>
          <input
            className="codigo-input"
            value={codigo}
            onChange={(e) => setCodigo(normalizarCodigo(e.target.value))}
            placeholder="ABCD"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <button
          onClick={alUnirse}
          disabled={!nombreOk || !esCodigoValido(codigo) || ocupado !== null}
        >
          {ocupado === 'unirse' ? 'Entrando…' : 'Entrar'}
        </button>
      </section>

      {error && <p className="error">{error}</p>}
    </div>
  )
}
