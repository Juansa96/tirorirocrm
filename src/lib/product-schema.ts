// Shared product schema: used by the public lead-form API and ProductoForm UI
// Single source of truth for model names and dimension logic

function sanitize(val: unknown, maxLen = 200): string {
  if (val === null || val === undefined) return "";
  return String(val).trim().slice(0, maxLen);
}

export const TIPOS_VALIDOS = ["cabecero", "banco", "cojin", "puf", "mesa", "pantalla"] as const;
export type TipoProductoKey = (typeof TIPOS_VALIDOS)[number];

export const CABECERO_FORMAS: Record<string, string> = {
  recto: "Calobra",
  semicirculo: "Pregonda",
  "corona-simple": "Macarella",
  "corona-doble": "Conta",
  ondas: "Barbaria",
};

// Banco Oyambre — precios fijos por medida (coinciden con el configurador web).
// Alto 45 cm y fondo 33 cm son fijos en las medidas estándar.
export const BANCO_OYAMBRE_PRECIOS: Record<string, number> = {
  "60": 200,
  "60-doble": 370,
  "90": 250,
  "120": 300,
  "150": 350,
  "custom": 0, // "Mis medidas" — a consultar
};

export const BANCO_VARIANTES: Record<string, string> = {
  "60": "Oyambre 60 cm",
  "60-doble": "Oyambre 60 cm doble",
  "90": "Oyambre 90 cm",
  "120": "Oyambre 120 cm",
  "150": "Oyambre 150 cm",
  "custom": "Oyambre a medida",
};


export const PANTALLA_FORMAS: Record<string, string> = {
  cilindro: "Almanzor",
  cuadrado: "Tormes",
  rectangulo: "La Serrota",
};

export function buildProducto(config: Record<string, string>, createdBy = "formulario-web") {
  const tipo = sanitize(config.tipo, 50);
  if (!tipo || !(TIPOS_VALIDOS as readonly string[]).includes(tipo)) return null;

  let modelo = "";
  let ancho: number | null = null;
  let alto: number | null = null;
  let color = "";
  let relleno = "";
  let patas = "";

  if (tipo === "cabecero") {
    modelo = CABECERO_FORMAS[config.forma] ?? sanitize(config.forma, 50);
    ancho = config.anchoCama
      ? Math.min(Number(config.anchoCama), 400)
      : config.ancho
      ? Math.min(Number(config.ancho), 400)
      : null;
    alto = config.altoCm
      ? Math.min(Number(config.altoCm), 300)
      : config.alto
      ? Math.min(Number(config.alto), 300)
      : null;
    color = sanitize(config.telaLateral);
    patas = config.colgador === "true" ? "Con colgador" : "";
  } else if (tipo === "banco") {
    modelo = BANCO_VARIANTES[config.varianteBanco] ?? sanitize(config.varianteBanco, 50);
    ancho = config.largoBanco ? Math.min(Number(config.largoBanco), 400) : null;
    alto = config.altoBanco ? Math.min(Number(config.altoBanco), 300) : null;
  } else if (tipo === "cojin") {
    modelo = sanitize(config.opcionAlmohadon?.replace(/-/g, " — "), 100);
    const dims = config.opcionAlmohadon?.split("-")[1]?.replace(" cm", "").split("×");
    ancho = dims ? Number(dims[0]) : null;
    alto = dims ? Number(dims[1]) : null;
  } else if (tipo === "puf") {
    modelo = `${sanitize(config.tamanoPuf, 20)} cm`;
    ancho = config.tamanoPuf ? Math.min(Number(config.tamanoPuf), 200) : null;
  } else if (tipo === "mesa") {
    modelo = sanitize(config.presetMesa, 50);
    const dims = (config.presetMesa ?? "").replace(" cm", "").split("×");
    ancho = dims[0] ? Number(dims[0]) : null;
    alto = dims[1] ? Number(dims[1]) : null;
    color = sanitize(config.superficieMesa) || "nada";
  } else if (tipo === "pantalla") {
    const forma = sanitize(config.formaPantalla, 30);
    modelo = `${PANTALLA_FORMAS[forma] ?? forma} ${sanitize(config.tamanoPantalla, 20)}`.trim();
    relleno = forma;
    patas = sanitize(config.tamanoPantalla, 20);
  }

  return {
    tipo,
    modelo,
    ancho: Number.isFinite(ancho) ? ancho : null,
    alto: Number.isFinite(alto) ? alto : null,
    tela: sanitize(config.tela ?? config.fabricName),
    color,
    relleno,
    patas,
    acabado: sanitize(config.acabado ?? config.finish, 30) || "vivo-simple",
    coleccion_tela:
      sanitize(config.coleccionTela, 30) ||
      (config.fabricGroup === "Premium" ? "Premium" : "Básicas"),
    cantidad: 1,
    precio_unitario: 0,
    notas_producto: "",
    created_by: createdBy,
  };
}
