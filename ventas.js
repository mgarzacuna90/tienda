// ===== ventas.js: elegir productos, carrito y cobro =====

// ---------- Cuadrícula de productos (pantalla Vender) ----------
function actualizarTarjeta(tarjeta, cantidad) {
  let insignia = tarjeta.querySelector(".insignia");
  if (cantidad > 0) {
    if (!insignia) {
      insignia = document.createElement("span");
      insignia.className = "insignia";
      tarjeta.appendChild(insignia);
    }
    insignia.textContent = cantidad;
  } else if (insignia) {
    insignia.remove();
  }
  tarjeta.classList.toggle("elegida", cantidad > 0);
}

function pintarVender() {
  const texto = $("buscar-venta").value.trim().toLowerCase();
  const visibles = productos.filter((p) => p.nombre.toLowerCase().includes(texto));
  const cuadricula = $("cuadricula");
  cuadricula.replaceChildren();

  if (visibles.length === 0) {
    const vacio = document.createElement("p");
    vacio.className = "vacio";
    vacio.style.gridColumn = "1 / -1";
    vacio.textContent = productos.length === 0
      ? "Aún no hay productos. Agrégalos en la pestaña Productos."
      : "No hay productos con ese nombre.";
    cuadricula.appendChild(vacio);
    return;
  }

  for (const p of visibles) {
    const tarjeta = document.createElement("button");
    tarjeta.type = "button";
    tarjeta.className = "tarjeta";
    tarjeta.id = "tarjeta-" + p.id;
    tarjeta.setAttribute("aria-label", "Agregar " + p.nombre);

    const nombre = document.createElement("div");
    nombre.className = "t-nombre";
    nombre.textContent = p.nombre;
    const precio = document.createElement("div");
    precio.className = "t-precio";
    precio.textContent = dinero.format(p.precio);

    tarjeta.append(crearMiniatura(p, "foto"), nombre, precio);
    actualizarTarjeta(tarjeta, carrito[p.id] || 0);
    tarjeta.addEventListener("click", () => cambiarCantidad(p.id, 1));
    cuadricula.appendChild(tarjeta);
  }
}

$("buscar-venta").addEventListener("input", pintarVender);

function cambiarCantidad(id, cambio) {
  const nueva = Math.max(0, (carrito[id] || 0) + cambio);
  if (nueva === 0) delete carrito[id];
  else carrito[id] = nueva;

  const tarjeta = $("tarjeta-" + id);
  if (tarjeta) actualizarTarjeta(tarjeta, nueva);

  aviso("msg-venta", "");
  aviso("msg-carrito", "");
  pintarCarrito();
  actualizarCobro();
}

// ---------- Total y barra de abajo ----------
function calcularCarrito() {
  let total = 0;
  let cantidadTotal = 0;
  const items = [];
  for (const p of productos) {
    const q = carrito[p.id];
    if (q > 0) {
      total += p.precio * q;
      cantidadTotal += q;
      items.push({ producto_id: p.id, cantidad: q });
    }
  }
  return { total: redondear(total), cantidadTotal, items };
}

function actualizarCobro() {
  const { total, cantidadTotal } = calcularCarrito();
  $("barra-cobro").hidden = !(cantidadTotal > 0 && vistaActual === "vender");
  $("cobro-detalle").textContent = cantidadTotal + (cantidadTotal === 1 ? " artículo" : " artículos");
  $("cobro-total").textContent = dinero.format(total);
}

$("btn-ver-carrito").addEventListener("click", () => irA("carrito"));
$("volver-carrito").addEventListener("click", () => irA("vender"));

// ---------- Pantalla del carrito ----------
function pintarCarrito() {
  const lista = $("lista-carrito");
  lista.replaceChildren();
  const { total, items } = calcularCarrito();

  if (items.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "vacio";
    vacio.textContent = "El carrito está vacío. Vuelve a Vender y toca los productos.";
    lista.appendChild(vacio);
  }

  for (const p of productos) {
    const cantidad = carrito[p.id];
    if (!(cantidad > 0)) continue;

    const li = document.createElement("li");
    li.className = "item";

    const fila = document.createElement("div");
    fila.className = "fila-item";

    const izquierda = document.createElement("div");
    izquierda.className = "con-foto";
    const textos = document.createElement("div");
    const nombre = document.createElement("div");
    nombre.className = "nombre";
    nombre.textContent = p.nombre;
    const detalle = document.createElement("div");
    detalle.className = "detalle";
    detalle.textContent = dinero.format(p.precio) + " c/u";
    textos.append(nombre, detalle);
    izquierda.append(crearMiniatura(p, "foto-chica"), textos);

    const subtotal = document.createElement("div");
    subtotal.className = "precio";
    subtotal.textContent = dinero.format(p.precio * cantidad);

    fila.append(izquierda, subtotal);

    const controles = document.createElement("div");
    controles.className = "controles-carrito";

    const grupo = document.createElement("div");
    grupo.className = "cantidad";

    const menos = document.createElement("button");
    menos.type = "button";
    menos.className = "paso secundario";
    menos.textContent = "−";
    menos.setAttribute("aria-label", "Quitar uno de " + p.nombre);
    menos.addEventListener("click", () => cambiarCantidad(p.id, -1));

    const num = document.createElement("span");
    num.className = "num";
    num.textContent = cantidad;

    const mas = document.createElement("button");
    mas.type = "button";
    mas.className = "paso";
    mas.textContent = "+";
    mas.setAttribute("aria-label", "Agregar uno de " + p.nombre);
    mas.addEventListener("click", () => cambiarCantidad(p.id, 1));

    grupo.append(menos, num, mas);

    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "peligro";
    quitar.textContent = "Quitar";
    quitar.addEventListener("click", () => cambiarCantidad(p.id, -cantidad));

    controles.append(grupo, quitar);
    li.append(fila, controles);
    lista.appendChild(li);
  }

  $("carrito-total").textContent = dinero.format(total);
  $("btn-cobrar").disabled = items.length === 0;
}

// ---------- Contado o a crédito ----------
function ponerTipoDePago(credito) {
  aCredito = credito;
  $("pago-contado").classList.toggle("secundario", credito);
  $("pago-credito").classList.toggle("secundario", !credito);
  $("pago-contado").setAttribute("aria-pressed", String(!credito));
  $("pago-credito").setAttribute("aria-pressed", String(credito));
  $("bloque-cliente").hidden = !credito;
  aviso("msg-carrito", "");
}

$("pago-contado").addEventListener("click", () => ponerTipoDePago(false));
$("pago-credito").addEventListener("click", () => ponerTipoDePago(true));

function llenarSelectClientes() {
  const sel = $("sel-cliente");
  const actual = sel.value;
  sel.replaceChildren();

  const base = document.createElement("option");
  base.value = "";
  base.textContent = "Elige un cliente";
  sel.appendChild(base);

  for (const c of clientes) {
    const opcion = document.createElement("option");
    opcion.value = String(c.id);
    opcion.textContent = c.nombre + (c.saldo > 0 ? " (debe " + dinero.format(c.saldo) + ")" : "");
    sel.appendChild(opcion);
  }

  sel.value = actual;
  $("sin-clientes").hidden = clientes.length > 0;
}

// ---------- Cobrar ----------
$("btn-cobrar").addEventListener("click", async () => {
  const { total, items } = calcularCarrito();
  if (items.length === 0) return;

  const clienteId = $("sel-cliente").value ? Number($("sel-cliente").value) : null;
  if (aCredito && !clienteId) {
    aviso("msg-carrito", "Elige un cliente para vender a crédito.", "error");
    window.scrollTo(0, 0);
    return;
  }

  const cliente = clientes.find((c) => c.id === clienteId);
  const pregunta = aCredito
    ? "¿Cobrar " + dinero.format(total) + " a crédito a " + cliente.nombre + "?"
    : "¿Cobrar " + dinero.format(total) + "?";
  if (!window.confirm(pregunta)) return;

  const boton = $("btn-cobrar");
  boton.disabled = true;
  aviso("msg-carrito", "");

  // Esta función de Supabase guarda la venta y descuenta el inventario en un solo paso.
  const { error } = await db.rpc("registrar_venta", {
    items,
    p_cliente_id: aCredito ? clienteId : null,
    p_a_credito: aCredito,
  });

  if (error) {
    boton.disabled = false;
    const conocido = /cliente|no encontrado/i.test(error.message || "");
    aviso(
      "msg-carrito",
      conocido
        ? error.message + ". Revisa la venta e intenta otra vez."
        : "No se pudo registrar la venta. Revisa tu internet e intenta otra vez.",
      "error"
    );
    await cargarProductos();
    window.scrollTo(0, 0);
    return;
  }

  const detalleCredito = aCredito ? " (a crédito a " + cliente.nombre + ")" : "";
  carrito = {};
  $("buscar-venta").value = "";
  $("sel-cliente").value = "";
  ponerTipoDePago(false);
  irA("vender");
  aviso("msg-venta", "Venta guardada ✓ Total: " + dinero.format(total) + detalleCredito, "ok");
  await Promise.all([cargarProductos(), cargarClientes()]);
});
