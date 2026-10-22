// ===== app.js: conexión, datos básicos y navegación =====

// ---------- 1. Conexión con tu base de datos ----------
// Estos dos datos son públicos; la seguridad la dan los permisos que ya configuraste.
const SUPABASE_URL = "https://vyrpnkbvurbueugpuwak.supabase.co";
const SUPABASE_KEY = "sb_publishable_zMYMbcXO528BkfF1DEKwKw_S5DmUrRf";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- 2. Elementos, datos y ayudas ----------
const $ = (id) => document.getElementById(id);
const vistaLogin = $("vista-login");
const vistas = {
  vender: $("vista-vender"),
  carrito: $("vista-carrito"),
  clientes: $("vista-clientes"),
  productos: $("vista-productos"),
  comprar: $("vista-comprar"),
  historial: $("vista-historial"),
  nuevocliente: $("vista-nuevo-cliente"),
  editarcliente: $("vista-editar-cliente"),
  nuevoproducto: $("vista-nuevo-producto"),
  cuenta: $("vista-cuenta"),
  pago: $("vista-pago"),
};

// Qué pestaña de abajo queda marcada en cada pantalla
const PESTANA = {
  vender: "vender",
  carrito: "vender",
  historial: "vender",
  clientes: "clientes",
  nuevocliente: "clientes",
  editarcliente: "clientes",
  cuenta: "clientes",
  pago: "clientes",
  productos: "productos",
  nuevoproducto: "productos",
  comprar: "productos",
};

let productos = [];         // lista de productos que viene de la base de datos
let clientes = [];          // clientes con lo que deben
let carrito = {};           // la venta en curso: { idProducto: cantidad }
let aCredito = false;       // ¿la venta en curso es a crédito?
let abonandoId = null;      // cliente al que se le captura un abono
let editandoId = null;      // producto que se está editando
let compras = {};           // cantidades escritas en "Por comprar": { idProducto: texto }
let vistaActual = "vender"; // pantalla que se está viendo

// Pesos enteros, sin centavos
const dinero = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const redondear = (n) => Math.round(Number(n));

function aviso(idElemento, texto, tipo) {
  const el = $(idElemento);
  el.textContent = texto || "";
  el.className = "mensaje" + (tipo ? " " + tipo : "");
}

// Crea una etiqueta con su campo (se usa en varios formularios)
function crearCampo(textoEtiqueta, id, tipo, valor) {
  const etiqueta = document.createElement("label");
  etiqueta.htmlFor = id;
  etiqueta.textContent = textoEtiqueta;
  const input = document.createElement("input");
  input.id = id;
  input.type = tipo;
  input.value = valor;
  return { etiqueta, input };
}

// ---------- 3. Mostrar una pantalla u otra ----------
function mostrar(sesionActiva) {
  vistaLogin.hidden = sesionActiva;
  $("pie").hidden = !sesionActiva;

  if (sesionActiva) {
    irA(vistaActual);
    cargarProductos();
    cargarClientes();
    cargarPago();
  } else {
    for (const nombre in vistas) vistas[nombre].hidden = true;
    carrito = {};
    compras = {};
    abonandoId = null;
    editandoId = null;
  }
}

function irA(nombre) {
  vistaActual = nombre;
  const pestana = PESTANA[nombre];
  for (const clave in vistas) {
    vistas[clave].hidden = clave !== nombre;
    const boton = $("nav-" + clave);
    if (boton) boton.classList.toggle("activo", clave === pestana);
  }
  actualizarCobro();
  window.scrollTo(0, 0);
}

$("nav-vender").addEventListener("click", () => irA("vender"));
$("nav-clientes").addEventListener("click", () => irA("clientes"));
$("nav-productos").addEventListener("click", () => irA("productos"));
