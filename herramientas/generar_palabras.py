#!/usr/bin/env python3
"""
Generador de la lista de palabras raras para Balderdash.

Pipeline en 4 pasos. Ninguno necesita red ni dependencias salvo el paso 1, que
necesita dos archivos bajados a mano, y el 2/3, que son el ida y vuelta con
quien escribe las definiciones.

  1) filtrar      Cruza el volcado de Wiktionary (kaikki.org) contra una lista
                  de frecuencia de uso y deja solo las que casi nadie conoce.
                  Salida: candidatos.csv

  2) pendientes   Saca una tanda de palabras sin definición a un JSON, con su
                  glosa en inglés, para que alguien las redacte.

  3) incorporar   Mete las definiciones redactadas de vuelta en el CSV.

  4) exportar     Toma el CSV ya curado y escribe src/data/palabras.ts

Los pasos 2 y 3 reemplazan al viejo `redactar`, que llamaba a la API de un LLM.
Se sacó a propósito: el proyecto no gasta en API para construirse. Si alguna vez
se quiere automatizar, el camino es la Batch API (50% más barata) con structured
outputs, no un bucle de requests sueltos.

--------------------------------------------------------------------------------
INSUMOS DEL PASO 1 (bajalos a mano una vez)

  Diccionario (~1 GB sin comprimir, se lee en streaming, no entra en RAM):
    https://kaikki.org/dictionary/Spanish/
    Bajar "kaikki.org-dictionary-Spanish.jsonl" del pie de la pagina.
    Las glosas vienen en ingles porque la extraccion es del Wiktionary ingles.

  Frecuencia de uso (subtitulos, ~5 MB):
    https://github.com/hermitdave/FrequencyWords
    content/2018/es/es_full.txt  (formato: "palabra cuenta" por linea)

--------------------------------------------------------------------------------
USO

  python herramientas/generar_palabras.py filtrar \
      --diccionario kaikki.org-dictionary-Spanish.jsonl \
      --frecuencias es_full.txt \
      --salida candidatos.csv

  python herramientas/generar_palabras.py pendientes --csv candidatos.csv \
      --cantidad 60 --salida tanda.json

  python herramientas/generar_palabras.py incorporar --csv candidatos.csv \
      --respuestas tanda-resuelta.json

  python herramientas/generar_palabras.py exportar --csv candidatos.csv \
      --salida src/data/palabras.ts --limite 800
"""

import argparse
import csv
import gzip
import json
import os
import re
import sys
import unicodedata

# ------------------------------------------------------------------------------
# Configuracion de filtros
# ------------------------------------------------------------------------------

POS_ACEPTADAS = {"noun", "verb", "adj"}

# Sufijos que hacen la palabra adivinable (diminutivos, aumentativos, adverbios
# derivados). Si termina asi, el jugador deduce el significado por morfologia.
SUFIJOS_TRANSPARENTES = (
    "mente", "ito", "ita", "itos", "itas", "illo", "illa", "illos", "illas",
    "ico", "ica", "cito", "cita", "azo", "aza", "ucho", "ucha", "ote", "ota",
    "isimo", "isima", "cion", "ciones", "dad", "dades", "idad",
)

# Glosas que indican que la entrada no es un lema con significado propio.
GLOSA_DESCARTABLE = re.compile(
    r"^(plural|feminine|masculine|singular|past participle|present participle|"
    r"gerund|inflection|form|alternative (form|spelling)|obsolete (form|spelling)|"
    r"misspelling|synonym|superlative|comparative|diminutive|augmentative|"
    r"archaic (form|spelling)|eye dialect|abbreviation|initialism|acronym|"
    r"clipping|apocopic form|nonstandard (form|spelling)) of ",
    re.IGNORECASE,
)

TAGS_DESCARTABLES = {
    "form-of", "abbreviation", "initialism", "acronym", "misspelling",
    "obsolete-spelling", "alt-of", "slur", "offensive", "vulgar", "romanization",
}

SOLO_LETRAS = re.compile(r"^[a-záéíóúüñ]+$")

CAMPOS = ["palabra", "pos", "rank", "glosa_en", "tags",
          "definicion", "apta", "motivo", "usar"]


def sin_tildes(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    )


def abrir(ruta: str):
    """Abre texto plano o .gz indistintamente."""
    if ruta.endswith(".gz"):
        return gzip.open(ruta, "rt", encoding="utf-8")
    return open(ruta, "r", encoding="utf-8")


def leer_csv(ruta: str) -> list:
    with open(ruta, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def escribir_csv(ruta: str, filas: list) -> None:
    with open(ruta, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CAMPOS)
        w.writeheader()
        w.writerows(filas)


# ------------------------------------------------------------------------------
# Paso 1: filtrar
# ------------------------------------------------------------------------------

def cargar_frecuencias(ruta: str) -> dict:
    """Devuelve {palabra: rank}. rank 1 = la mas usada del idioma."""
    ranks = {}
    with abrir(ruta) as f:
        for i, linea in enumerate(f, start=1):
            partes = linea.split()
            if not partes:
                continue
            # setdefault: si una palabra aparece dos veces, vale la primera
            # (la mas frecuente), no la ultima.
            ranks.setdefault(partes[0].lower(), i)
    return ranks


def es_transparente(palabra: str, ranks: dict, tope_stem: int) -> bool:
    """
    Heuristica simple de 'se adivina por la raiz'.

    a) Termina en un sufijo derivativo obvio.
    b) Alguna palabra comun de 5+ letras es prefijo de esta y lo que sobra son
       4 letras o menos (ej: 'camionaje' sobre 'camion').
    """
    plano = sin_tildes(palabra)

    if plano.endswith(SUFIJOS_TRANSPARENTES):
        return True

    # El tope es len(plano), no len(plano) - 1: con el anterior, las palabras de
    # 5 y 6 letras nunca pasaban por este chequeo porque el range quedaba vacio.
    for corte in range(5, len(plano)):
        if len(plano) - corte > 4:
            continue
        rank = ranks.get(plano[:corte])
        if rank is not None and rank <= tope_stem:
            return True

    return False


def primera_glosa(entrada: dict):
    """
    Devuelve (glosa, tags) del primer sentido utilizable, o (None, None).

    Cada sentido que no sirve se saltea, no aborta la entrada: en Wiktionary es
    comun que el primer sentido sea "plural of X" y el segundo sea el lema de
    verdad. Con un `return` temprano se perdian esas palabras.
    """
    for sentido in entrada.get("senses", []):
        if sentido.get("form_of"):
            continue

        tags = set(sentido.get("tags") or [])
        if tags & TAGS_DESCARTABLES:
            continue

        glosas = sentido.get("glosses") or []
        if not glosas:
            continue

        glosa = glosas[0].strip()
        if GLOSA_DESCARTABLE.match(glosa):
            continue
        if len(glosa) < 12 or len(glosa) > 220:
            continue

        return glosa, sorted(tags)

    return None, None


def cmd_filtrar(args):
    print("Cargando frecuencias...", file=sys.stderr)
    ranks = cargar_frecuencias(args.frecuencias)
    print(f"  {len(ranks):,} palabras con frecuencia conocida", file=sys.stderr)

    vistas = set()
    filas = []
    descartes = {
        "pos": 0, "sin_glosa_util": 0, "grafia": 0, "largo": 0,
        "comun": 0, "transparente": 0, "duplicada": 0,
    }

    print("Recorriendo el diccionario...", file=sys.stderr)
    with abrir(args.diccionario) as f:
        for n, linea in enumerate(f, start=1):
            if n % 250_000 == 0:
                print(f"  {n:,} lineas | {len(filas):,} candidatas", file=sys.stderr)

            linea = linea.strip()
            if not linea:
                continue
            try:
                entrada = json.loads(linea)
            except json.JSONDecodeError:
                continue

            palabra = (entrada.get("word") or "").strip().lower()
            pos = entrada.get("pos")

            if pos not in POS_ACEPTADAS:
                descartes["pos"] += 1
                continue
            if not SOLO_LETRAS.match(palabra):
                descartes["grafia"] += 1
                continue
            if not (args.largo_min <= len(palabra) <= args.largo_max):
                descartes["largo"] += 1
                continue
            if palabra in vistas:
                descartes["duplicada"] += 1
                continue

            rank = ranks.get(palabra)
            if rank is not None and rank <= args.umbral:
                descartes["comun"] += 1
                continue

            glosa, tags = primera_glosa(entrada)
            if not glosa:
                descartes["sin_glosa_util"] += 1
                continue

            if es_transparente(palabra, ranks, args.tope_stem):
                descartes["transparente"] += 1
                continue

            vistas.add(palabra)
            filas.append({
                "palabra": palabra,
                "pos": pos,
                "rank": rank if rank is not None else "",
                "glosa_en": glosa,
                "tags": ",".join(tags or []),
                "definicion": "",
                "apta": "",
                "motivo": "",
                "usar": "",
            })

    # Las que no aparecen en la lista de frecuencia son las mas oscuras: primero.
    filas.sort(key=lambda r: (r["rank"] if r["rank"] != "" else 10**9), reverse=True)
    escribir_csv(args.salida, filas)

    print(f"\nListo: {len(filas):,} candidatas -> {args.salida}", file=sys.stderr)
    print("Descartes:", file=sys.stderr)
    for k, v in descartes.items():
        print(f"  {k:16} {v:,}", file=sys.stderr)


# ------------------------------------------------------------------------------
# Pasos 2 y 3: ida y vuelta con quien redacta
# ------------------------------------------------------------------------------

CONSIGNA = """\
Para cada palabra devolve un objeto con:

  palabra     la misma que te paso, sin cambiarle nada
  definicion  la definicion verdadera en castellano rioplatense coloquial, como
              se la explicarias a un amigo en un asado. Entre 5 y 16 palabras.
              Sin "dicho de", sin "perteneciente o relativo a", sin punto final.
              NUNCA usar la palabra definida ni su raiz dentro de la definicion.
  apta        true si sirve para el juego, false si no.
              false cuando: se adivina por la raiz o por parecido con otra
              palabra comun; es un tecnicismo de un campo muy cerrado; es un
              gentilicio, nombre propio o marca; es un regionalismo que un
              argentino no reconoceria; la glosa en ingles es ambigua y no
              permite escribir una definicion confiable.
  motivo      si apta es false, 3 a 6 palabras explicando por que. Si no, "".

Las mejores son las de etimologia opaca y significado concreto y visual: un
objeto, un gesto, un tipo de persona, un estado del clima."""


def cmd_pendientes(args):
    filas = leer_csv(args.csv)
    pendientes = [r for r in filas if not r["definicion"]][:args.cantidad]

    if not pendientes:
        print("No queda ninguna pendiente.", file=sys.stderr)
        return

    salida = {
        "consigna": CONSIGNA,
        "palabras": [
            {"palabra": r["palabra"], "pos": r["pos"], "glosa_en": r["glosa_en"]}
            for r in pendientes
        ],
    }
    with open(args.salida, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=2)

    restantes = sum(1 for r in filas if not r["definicion"]) - len(pendientes)
    print(f"{len(pendientes)} palabras -> {args.salida}", file=sys.stderr)
    print(f"Quedan {restantes:,} pendientes despues de esta tanda.", file=sys.stderr)


def cmd_incorporar(args):
    filas = leer_csv(args.csv)
    indice = {r["palabra"]: r for r in filas}

    with open(args.respuestas, encoding="utf-8") as f:
        datos = json.load(f)
    respuestas = datos["palabras"] if isinstance(datos, dict) else datos

    incorporadas, sin_match, vacias = 0, [], 0
    for item in respuestas:
        palabra = (item.get("palabra") or "").strip()
        fila = indice.get(palabra)
        if not fila:
            sin_match.append(palabra)
            continue
        definicion = (item.get("definicion") or "").strip()
        if not definicion:
            vacias += 1
            continue
        fila["definicion"] = definicion
        fila["apta"] = "si" if item.get("apta") else "no"
        fila["motivo"] = (item.get("motivo") or "").strip()
        incorporadas += 1

    escribir_csv(args.csv, filas)

    print(f"{incorporadas} definiciones incorporadas.", file=sys.stderr)
    if vacias:
        print(f"  {vacias} venian sin definicion y se saltearon.", file=sys.stderr)
    if sin_match:
        # Casi siempre es una palabra devuelta con otra grafia (tilde de menos).
        print(f"  {len(sin_match)} no estaban en el CSV: "
              f"{', '.join(sin_match[:8])}", file=sys.stderr)

    aptas = sum(1 for r in filas if r["apta"] == "si")
    pendientes = sum(1 for r in filas if not r["definicion"])
    print(f"\nTotal: {aptas:,} aptas, {pendientes:,} pendientes.", file=sys.stderr)


# ------------------------------------------------------------------------------
# Paso 4: exportar
# ------------------------------------------------------------------------------

def cmd_exportar(args):
    filas = leer_csv(args.csv)

    # 'usar' es el veto manual y le gana a lo que haya dicho quien redacto.
    elegidas = [
        r for r in filas
        if r["definicion"]
        and r["usar"].strip().lower() != "no"
        and (r["apta"] == "si" or r["usar"].strip().lower() == "si")
    ]

    if args.limite:
        elegidas = elegidas[:args.limite]

    # El id termina siendo una clave de Firebase. Las tildes y la ñ son validas
    # ahi; lo que no se puede es . / $ # [ ] — y SOLO_LETRAS ya los descarto.
    repetidos = [p for p in {r["palabra"] for r in elegidas}
                 if sum(1 for r in elegidas if r["palabra"] == p) > 1]
    if repetidos:
        sys.exit(f"Hay palabras repetidas, arreglalas antes de exportar: {repetidos[:10]}")

    destino = os.path.dirname(args.salida)
    if destino:
        os.makedirs(destino, exist_ok=True)

    with open(args.salida, "w", encoding="utf-8") as f:
        f.write("// Generado por herramientas/generar_palabras.py. No editar a mano.\n")
        f.write("// Para ampliar la lista, ver el README.\n\n")
        f.write("import type { Palabra } from '../tipos'\n\n")
        f.write("export const PALABRAS: Palabra[] = [\n")
        for r in elegidas:
            pal = json.dumps(r["palabra"], ensure_ascii=False)
            dfn = json.dumps(r["definicion"], ensure_ascii=False)
            f.write(f"  {{ id: {pal}, palabra: {pal}, definicion: {dfn} }},\n")
        f.write("]\n\n")
        # Lo importan Lobby.tsx e Inicio.tsx: sin esto el proyecto no compila.
        f.write("export const TOTAL_PALABRAS = PALABRAS.length\n")

    print(f"{len(elegidas):,} palabras -> {args.salida}", file=sys.stderr)


# ------------------------------------------------------------------------------

def main():
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="comando", required=True)

    f = sub.add_parser("filtrar", help="cruza diccionario y frecuencias")
    f.add_argument("--diccionario", required=True)
    f.add_argument("--frecuencias", required=True)
    f.add_argument("--salida", default="candidatos.csv")
    f.add_argument("--umbral", type=int, default=40_000,
                   help="descarta palabras dentro de las N mas usadas")
    f.add_argument("--tope-stem", type=int, default=15_000,
                   help="rango de palabras comunes usado para detectar raices")
    f.add_argument("--largo-min", type=int, default=5)
    f.add_argument("--largo-max", type=int, default=16)
    f.set_defaults(func=cmd_filtrar)

    n = sub.add_parser("pendientes", help="saca una tanda para redactar")
    n.add_argument("--csv", default="candidatos.csv")
    n.add_argument("--cantidad", type=int, default=60)
    n.add_argument("--salida", default="tanda.json")
    n.set_defaults(func=cmd_pendientes)

    i = sub.add_parser("incorporar", help="mete las definiciones redactadas")
    i.add_argument("--csv", default="candidatos.csv")
    i.add_argument("--respuestas", required=True)
    i.set_defaults(func=cmd_incorporar)

    e = sub.add_parser("exportar", help="escribe palabras.ts")
    e.add_argument("--csv", default="candidatos.csv")
    e.add_argument("--salida", default="src/data/palabras.ts")
    e.add_argument("--limite", type=int, default=0)
    e.set_defaults(func=cmd_exportar)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
