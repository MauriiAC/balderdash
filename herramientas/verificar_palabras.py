#!/usr/bin/env python3
"""
Contrasta una lista de palabras y definiciones contra el Wikcionario en espanol.

No decide nada por su cuenta: confirma que la palabra existe, trae la definicion
de referencia y deja las dos al lado para que una persona compare. La idea es
cazar el error que no se nota — una definicion escrita de memoria que suena
perfecta y esta equivocada — antes de que llegue a la mesa.

Opcionalmente cruza contra una lista de frecuencia de uso para confirmar que la
palabra es efectivamente rara y no solo suena rara.

Solo stdlib. Usa la API publica de MediaWiki, que es gratuita.

--------------------------------------------------------------------------------
USO

  python3 herramientas/verificar_palabras.py --entrada tanda.json \
      --salida revisadas.csv

  # con el cruce de frecuencia (opcional, es_full.txt son ~5 MB):
  #   https://github.com/hermitdave/FrequencyWords -> content/2018/es/es_full.txt
  python3 herramientas/verificar_palabras.py --entrada tanda.json \
      --salida revisadas.csv --frecuencias es_full.txt

ENTRADA: un JSON con una lista de objetos {palabra, definicion, apta?, motivo?},
o un objeto {"palabras": [...]}.
"""

import argparse
import csv
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

API = "https://es.wiktionary.org/w/api.php"

# Wikimedia pide un User-Agent que identifique a quien consulta.
USER_AGENT = "BalderdashWordCheck/1.0 (juego entre amigos; uso personal)"

# Titulos por request. Se pide el wikitexto crudo y no `prop=extracts`, porque
# extracts es una extension pensada para Wikipedia y en el Wikcionario devuelve
# vacio para buena parte de las paginas (probado: "mesa" volvia sin nada).
POR_LOTE = 25

CAMPOS = [
    "palabra", "definicion", "apta", "motivo", "usar",
    "wikt_existe", "wikt_definicion", "coincidencia", "rank",
]


def pedir(titulos: list, reintentos: int = 3) -> dict:
    """Devuelve {titulo: wikitexto_o_None} para un lote de palabras."""
    params = {
        "action": "query",
        "format": "json",
        "formatversion": "2",
        "prop": "revisions",
        "rvprop": "content",
        "rvslots": "main",
        "titles": "|".join(titulos),
    }
    url = f"{API}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})

    for intento in range(reintentos):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                datos = json.loads(resp.read())
            break
        except urllib.error.HTTPError as e:
            # Un 4xx que no sea 429 no se arregla reintentando.
            if e.code != 429 and 400 <= e.code < 500:
                sys.exit(f"La API respondio {e.code}. Revisa la consulta.")
            espera = 2 ** intento
            print(f"    HTTP {e.code}, reintento en {espera}s", file=sys.stderr)
            time.sleep(espera)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            espera = 2 ** intento
            print(f"    {type(e).__name__}, reintento en {espera}s", file=sys.stderr)
            time.sleep(espera)
    else:
        return {t: None for t in titulos}

    salida = {}
    # La API normaliza titulos (mayusculas, acentos); hay que deshacer el mapeo.
    normalizados = {n["to"]: n["from"]
                    for n in datos.get("query", {}).get("normalized", [])}
    for pagina in datos.get("query", {}).get("pages", []):
        titulo = pagina.get("title", "")
        original = normalizados.get(titulo, titulo)
        if "missing" in pagina or not pagina.get("revisions"):
            salida[original] = None
        else:
            salida[original] = pagina["revisions"][0]["slots"]["main"]["content"]
    return salida


def seccion_espanol(wikitexto: str) -> str:
    """
    El Wikcionario junta varios idiomas en la misma pagina. La del castellano
    abre con "== {{lengua|es}} ==" y termina donde arranca el proximo titulo
    de nivel 2.
    """
    if not wikitexto:
        return ""
    apertura = re.search(r"==\s*\{\{lengua\|es\}\}\s*==", wikitexto)
    if not apertura:
        return ""
    resto = wikitexto[apertura.end():]
    cierre = re.search(r"\n==[^=]", resto)
    return resto[:cierre.start()] if cierre else resto


def _comun(texto: str) -> str:
    """Lo que se limpia igual en los dos intentos: enlaces, cursivas, HTML."""
    # Las notas al pie no aportan nada a la definicion.
    texto = re.sub(r"<ref[^>]*>.*?</ref>", "", texto, flags=re.S)
    texto = re.sub(r"<ref[^>]*/?>", "", texto)
    texto = re.sub(r"<[^>]+>", "", texto)
    # [[enlace|texto]] -> texto ; [[enlace]] -> enlace
    texto = re.sub(r"\[\[(?:[^\]|]+\|)?([^\]]+)\]\]", r"\1", texto)
    texto = texto.replace("'''", "").replace("''", "")
    return re.sub(r"\s+", " ", texto).strip(" :;.,")


def limpiar(texto: str) -> str:
    """Wikitexto a texto legible."""
    # {{plm|mueble}} y {{l+|es|x}} guardan la palabra util en el ultimo campo.
    texto = re.sub(r"\{\{(?:plm|l\+?)\|(?:[a-z]{2,3}\|)?([^}|]+)\}\}", r"\1", texto)
    # El resto de las plantillas son metadatos: categorias, marcas de uso.
    limpio = _comun(re.sub(r"\{\{[^{}]*\}\}", "", texto))
    if limpio:
        return limpio

    # Algunas acepciones SON una plantilla, no la traen: "cazcarria" es
    # {{grafía alternativa|cascarria}} y nada mas. Borrarla dejaba la fila
    # vacia, que es justo el caso donde mas hace falta ver el original.
    def desarmar(m: re.Match) -> str:
        partes = [p.strip() for p in m.group(1).split("|") if p.strip()]
        partes = [p for p in partes if not re.match(r"^(es|leng|glosa)=?$", p)]
        return " ".join(partes)

    return _comun(re.sub(r"\{\{([^{}]*)\}\}", desarmar, texto))


def resumir(seccion: str, limite: int = 240) -> str:
    """Las primeras acepciones, en una linea, para comparar de un vistazo."""
    if not seccion:
        return ""
    acepciones = []
    for linea in seccion.split("\n"):
        linea = linea.strip()
        if not linea.startswith(";"):
            continue
        # ";1 {{csem|x}}: definicion" -> lo que sigue al primer ":"
        cuerpo = linea.split(":", 1)[1] if ":" in linea else linea[1:]
        texto = limpiar(cuerpo)
        if texto:
            acepciones.append(texto)
        if len(acepciones) == 3:
            break
    return " / ".join(acepciones)[:limite]


# Palabras que aparecen en cualquier definicion y no aportan a la comparacion.
VACIAS = {
    "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al",
    "que", "se", "y", "o", "en", "con", "por", "para", "su", "sus", "lo",
    "es", "son", "como", "mas", "muy", "sin", "sobre", "cuando", "donde",
    "dicho", "dicha", "cosa", "persona", "alguien", "algo", "hace", "hacer",
    "tiene", "queda", "esta", "ser", "otro", "otra", "todo", "toda", "nada",
    "parte", "forma", "tipo", "especie", "generalmente", "particular", "suele",
}


def raices(texto: str) -> set:
    """Raices de las palabras con contenido, para comparar sin tropezar con
    las variaciones de genero y numero."""
    limpio = "".join(
        c for c in unicodedata.normalize("NFD", texto.lower())
        if unicodedata.category(c) != "Mn"
    )
    palabras = re.findall(r"[a-zñ]{3,}", limpio)
    return {p[:5] for p in palabras if p not in VACIAS}


def solapamiento(mia: str, referencia: str) -> float:
    """
    Que proporcion de lo que dice nuestra definicion aparece tambien en la del
    Wikcionario. No decide nada: ordena la revision para mirar primero las que
    tienen mas chances de estar mal.

    Es una señal ruidosa y conviene saberlo: nuestras definiciones son
    coloquiales a proposito y las del Wikcionario son formales, asi que dos
    formas correctas de decir lo mismo pueden no compartir una sola palabra.
    "chirimia" da 0.00 contra una definicion que dice lo mismo con otras
    palabras (flauta / instrumento de viento a modo de clarinete). Sirve para
    elegir por donde empezar, no para descartar sin leer.
    """
    a, b = raices(mia), raices(referencia)
    if not a or not b:
        return 0.0
    return len(a & b) / len(a)


def cargar_frecuencias(ruta: str) -> dict:
    ranks = {}
    with open(ruta, encoding="utf-8") as f:
        for i, linea in enumerate(f, start=1):
            partes = linea.split()
            if partes:
                ranks.setdefault(partes[0].lower(), i)
    return ranks


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--entrada", required=True, help="JSON con palabra/definicion")
    p.add_argument("--salida", default="revisadas.csv")
    p.add_argument("--frecuencias", help="es_full.txt, opcional")
    p.add_argument("--pausa", type=float, default=0.3,
                   help="segundos entre requests, por cortesia con la API")
    args = p.parse_args()

    with open(args.entrada, encoding="utf-8") as f:
        datos = json.load(f)
    items = datos["palabras"] if isinstance(datos, dict) else datos

    ranks = {}
    if args.frecuencias:
        print("Cargando frecuencias...", file=sys.stderr)
        ranks = cargar_frecuencias(args.frecuencias)

    palabras = [(it.get("palabra") or "").strip() for it in items]
    palabras = [p for p in palabras if p]
    total_req = (len(palabras) + POR_LOTE - 1) // POR_LOTE
    print(f"Consultando el Wikcionario por {len(palabras)} palabras "
          f"({total_req} requests)...", file=sys.stderr)

    wikitextos = {}
    for i in range(0, len(palabras), POR_LOTE):
        lote = palabras[i:i + POR_LOTE]
        wikitextos.update(pedir(lote))
        print(f"  {min(i + POR_LOTE, len(palabras))}/{len(palabras)}", file=sys.stderr)
        time.sleep(args.pausa)

    filas, sin_entrada, sin_espanol, sin_definicion = [], [], [], []
    for it in items:
        palabra = (it.get("palabra") or "").strip()
        wikitexto = wikitextos.get(palabra)
        existe = wikitexto is not None
        seccion = seccion_espanol(wikitexto or "")
        definicion_wikt = resumir(seccion)

        if not existe:
            sin_entrada.append(palabra)
        elif not seccion:
            sin_espanol.append(palabra)
        elif not definicion_wikt:
            sin_definicion.append(palabra)

        mia = (it.get("definicion") or "").strip()
        filas.append({
            "palabra": palabra,
            "definicion": mia,
            "apta": "si" if it.get("apta", True) else "no",
            "motivo": (it.get("motivo") or "").strip(),
            "usar": "",
            "wikt_existe": "si" if existe else "NO",
            "wikt_definicion": definicion_wikt,
            "coincidencia": round(solapamiento(mia, definicion_wikt), 2),
            "rank": ranks.get(palabra.lower(), "") if ranks else "",
        })

    with open(args.salida, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CAMPOS)
        w.writeheader()
        w.writerows(filas)

    print(f"\n{len(filas)} filas -> {args.salida}", file=sys.stderr)

    if sin_entrada:
        print(f"\n  NO EXISTEN en el Wikcionario ({len(sin_entrada)}):", file=sys.stderr)
        print(f"    {', '.join(sin_entrada)}", file=sys.stderr)
        print("    Puede ser un error de tipeo, o una palabra inventada.", file=sys.stderr)
    if sin_espanol:
        print(f"\n  EXISTEN PERO NO EN CASTELLANO ({len(sin_espanol)}):", file=sys.stderr)
        print(f"    {', '.join(sin_espanol)}", file=sys.stderr)
    if sin_definicion:
        print(f"\n  SIN DEFINICION LEGIBLE ({len(sin_definicion)}):", file=sys.stderr)
        print(f"    {', '.join(sin_definicion)}", file=sys.stderr)
        print("    Hay entrada en castellano pero no se pudo extraer el texto.",
              file=sys.stderr)
    if ranks:
        comunes = [f["palabra"] for f in filas
                   if isinstance(f["rank"], int) and f["rank"] <= 40_000]
        if comunes:
            print(f"\n  DEMASIADO COMUNES (entre las 40k mas usadas del idioma):",
                  file=sys.stderr)
            print(f"    {', '.join(comunes)}", file=sys.stderr)

    limpias = len(filas) - len(sin_entrada) - len(sin_espanol) - len(sin_definicion)
    print(f"\n{limpias}/{len(filas)} quedaron con definicion de referencia para "
          f"comparar.", file=sys.stderr)

    # La columna `coincidencia` no decide: ordena la revision. Una baja puede
    # ser una definicion equivocada, o puede ser la misma idea dicha con otras
    # palabras. Hay que mirarlas igual, pero primero estas.
    revisar = sorted(
        (f for f in filas if f["wikt_definicion"]),
        key=lambda f: f["coincidencia"],
    )[:20]
    if revisar:
        print("\n  MIRAR PRIMERO (menos palabras en comun con la referencia):",
              file=sys.stderr)
        for f in revisar:
            print(f"    {f['coincidencia']:.2f}  {f['palabra']}", file=sys.stderr)

    print("\nAbri el CSV y compara `definicion` contra `wikt_definicion`.",
          file=sys.stderr)
    print("Marca `usar` en no para descartar una fila.", file=sys.stderr)


if __name__ == "__main__":
    main()
