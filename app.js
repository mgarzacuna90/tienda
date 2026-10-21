// ===== app.js: conexión, datos básicos y pantalla de Productos =====

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
  clientes: $("vista-clientes"),
  productos: $("vista-productos"),
  historial: $("vista-historial"),
};

let productos = [];         // lista de productos que viene de la base de datos
let clientes = [];          // clientes con lo que deben
let carrito = {};           // la venta en curso: { idProducto: cantidad }
let aCredito = false;       // ¿la venta en curso es a crédito?
let abonandoId = null;      // cliente al que se le captura un abono
let editandoId = null;      // producto que se está editando
let vistaActual = "vender"; // pantalla que se está viendo

const dinero = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const redondear = (n) => Math.round(Number(n) * 100) / 100;

function aviso(idElemento, texto, tipo) {
  const el = $(idElemento);
  el.textContent = texto || "";
  el.className = "mensaje" + (tipo ? " " + tipo : "");
}

// ---------- 3. Mostrar una pantalla u otra ----------
function mostrar(sesionActiva) {
  vistaLogin.hidden = sesionActiva;
  $("pie").hidden = !sesionActiva;

  if (sesionActiva) {
    irA(vistaActual);
    cargarProductos();
    cargarClientes();
  } else {
    for (const nombre in vistas) vistas[nombre].hidden = true;
    carrito = {};
    abonandoId = null;
    editandoId = null;
  }
}

function irA(nombre) {
  vistaActual = nombre;
  // El historial se abre desde Vender, así que deja marcada esa pestaña.
  const pestana = nombre === "historial" ? "vender" : nombre;
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

// ---------- 4. Leer productos ----------
async function cargarProductos() {
  const { data, error } = await db
    .from("productos")
    .select("id, nombre, precio, cantidad")
    .order("nombre", { ascending: true });

  if (error) {
    aviso("msg-lista", "No se pudo cargar la lista. Revisa tu internet e intenta otra vez.", "error");
    return;
  }
  aviso("msg-lista", "");
  productos = data;

  // Si el inventario cambió, ajustamos la venta en curso para no pasarnos.
  for (const id of Object.keys(carrito)) {
    const p = productos.find((x) => String(x.id) === id);
    if (!p || p.cantidad <= 0) {
      delete carrito[id];
    } else if (carrito[id] > p.cantidad) {
      carrito[id] = p.cantidad;
    }
  }

  pintarLista();
  pintarVender();
  actualizarCobro();
}

// ---------- 5. Lista de la pantalla "Productos" ----------
function pintarLista() {
  const texto = $("buscar").value.trim().toLowerCase();
  const visibles = productos.filter((p) => p.nombre.toLowerCase().includes(texto));
  const lista = $("lista");
  lista.replaceChildren();

  if (visibles.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "vacio";
    vacio.textContent = productos.length === 0
      ? "Aún no hay productos. Agrega el primero arriba."
      : "No hay productos con ese nombre.";
    lista.appendChild(vacio);
    return;
  }

  for (const p of visibles) {
    const li = document.createElement("li");
    li.className = "item";

    const fila = document.createElement("div");
    fila.className = "fila-item";

    const izquierda = document.createElement("div");
    const nombre = document.createElement("div");
    nombre.className = "nombre";
    nombre.textContent = p.nombre;
    const detalle = document.createElement("div");
    detalle.className = "detalle";
    detalle.textContent = "Quedan " + p.cantidad;
    izquierda.append(nombre, detalle);

    const derecha = document.createElement("div");
    derecha.className = "derecha-item";
    const precio = document.createElement("div");
    precio.className = "precio";
    precio.textContent = dinero.format(p.precio);
    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "secundario";
    editar.textContent = editandoId === p.id ? "Cerrar" : "Editar";
    editar.addEventListener("click", () => {
      editandoId = editandoId === p.id ? null : p.id;
      aviso("msg-editar", "");
      pintarLista();
    });
    derecha.append(precio, editar);

    fila.append(izquierda, derecha);
    li.appendChild(fila);

    if (editandoId === p.id) {
      li.appendChild(crearFormularioProducto(p));
    }

    lista.appendChild(li);
  }
}

$("buscar").addEventListener("input", pintarLista);

// ---------- 6. Editar o eliminar un producto ----------
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

function crearFormularioProducto(p) {
  const form = document.createElement("form");
  form.className = "subform";

  const nombre = crearCampo("Nombre", "edit-nombre", "text", p.nombre);
  nombre.input.required = true;
  nombre.input.autocomplete = "off";

  const precio = crearCampo("Precio", "edit-precio", "number", p.precio);
  precio.input.inputMode = "decimal";
  precio.input.min = "0";
  precio.input.step = "any";
  precio.input.required = true;

  const inventario = crearCampo("Cantidad en inventario", "edit-cantidad", "number", p.cantidad);
  inventario.input.inputMode = "numeric";
  inventario.input.min = "0";
  inventario.input.step = "1";
  inventario.input.required = true;

  const llegaron = crearCampo("¿Llegó mercancía? Escribe cuántas piezas llegaron (opcional)", "edit-llegaron", "number", "");
  llegaron.input.inputMode = "numeric";
  llegaron.input.min = "0";
  llegaron.input.step = "1";

  const botones = document.createElement("div");
  botones.className = "fila";

  const guardar = document.createElement("button");
  guardar.type = "submit";
  guardar.textContent = "Guardar cambios";

  const cancelar = document.createElement("button");
  cancelar.type = "button";
  cancelar.className = "secundario";
  cancelar.textContent = "Cancelar";
  cancelar.addEventListener("click", () => {
    editandoId = null;
    pintarLista();
  });
  botones.append(guardar, cancelar);

  const eliminar = document.createElement("button");
  eliminar.type = "button";
  eliminar.className = "peligro grande";
  eliminar.textContent = "Eliminar producto";

  form.append(
    nombre.etiqueta, nombre.input,
    precio.etiqueta, precio.input,
    inventario.etiqueta, inventario.input,
    llegaron.etiqueta, llegaron.input,
    botones, eliminar
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nuevoNombre = nombre.input.value.trim();
    const nuevoPrecio = Number(precio.input.value);
    const nuevaCantidad = parseInt(inventario.input.value, 10) + (parseInt(llegaron.input.value, 10) || 0);

    if (!nuevoNombre || !(nuevoPrecio >= 0) || !(nuevaCantidad >= 0)) {
      aviso("msg-editar", "Revisa los datos: el nombre, el precio y la cantidad deben estar completos.", "error");
      window.scrollTo(0, 0);
      return;
    }

    guardar.disabled = true;
    const { error } = await db
      .from("productos")
      .update({ nombre: nuevoNombre, precio: nuevoPrecio, cantidad: nuevaCantidad })
      .eq("id", p.id);
    guardar.disabled = false;

    if (error) {
      aviso("msg-editar", "No se pudieron guardar los cambios. Intenta otra vez.", "error");
      window.scrollTo(0, 0);
      return;
    }

    editandoId = null;
    await cargarProductos();
    aviso(
      "msg-editar",
      "Cambios guardados ✓ " + nuevoNombre + ": " + dinero.format(nuevoPrecio) + ", quedan " + nuevaCantidad + ".",
      "ok"
    );
    window.scrollTo(0, 0);
  });

  eliminar.addEventListener("click", async () => {
    if (!window.confirm("¿Eliminar " + p.nombre + "? Las ventas anteriores se conservan.")) return;

    eliminar.disabled = true;
    const { error } = await db.from("productos").delete().eq("id", p.id);
    eliminar.disabled = false;

    if (error) {
      aviso("msg-editar", "No se pudo eliminar el producto. Intenta otra vez.", "error");
      window.scrollTo(0, 0);
      return;
    }

    editandoId = null;
    await cargarProductos();
    aviso("msg-editar", p.nombre + " eliminado.", "ok");
    window.scrollTo(0, 0);
  });

  return form;
}

// ---------- 7. Agregar un producto nuevo ----------
$("form-agregar").addEventListener("submit", async (e) => {
  e.preventDefault();
  const boton = $("btn-guardar");
  boton.disabled = true;
  aviso("msg-agregar", "");

  const { error } = await db.from("productos").insert({
    nombre: $("nombre").value.trim(),
    precio: Number($("precio").value),
    cantidad: parseInt($("cantidad").value, 10),
  });

  boton.disabled = false;
  if (error) {
    aviso("msg-agregar", "No se pudo guardar el producto. Intenta otra vez.", "error");
    return;
  }

  $("form-agregar").reset();
  aviso("msg-agregar", "Producto guardado ✓", "ok");
  $("nombre").focus();
  cargarProductos();
});
