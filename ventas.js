// ===== ventas.js: pantalla de Vender (carrito, contado/crédito y cobro) =====

function cambiarCantidad(id, cambio, maximo) {
  const nueva = (carrito[id] || 0) + cambio;
  if (nueva <= 0) {
    delete carrito[id];
  } else {
    carrito[id] = Math.min(nueva, maximo);
  }
  aviso("msg-venta", "");
  pintarVender();
  actualizarCobro();
}

function pintarVender() {
  const texto = $("buscar-venta").value.trim().toLowerCase();
  const visibles = productos.filter((p) => p.nombre.toLowerCase().includes(texto));
  const lista = $("lista-venta");
  lista.replaceChildren();

  if (visibles.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "vacio";
    vacio.textContent = productos.length === 0
      ? "Aún no hay productos. Agrégalos en la pestaña Productos."
      : "No hay productos con ese nombre.";
    lista.appendChild(vacio);
    return;
  }

  for (const p of visibles) {
    const li = document.createElement("li");
    li.className = "producto";

    const izquierda = document.createElement("div");
    const nombre = document.createElement("div");
    nombre.className = "nombre";
    nombre.textContent = p.nombre;
    const detalle = document.createElement("div");
    detalle.className = "detalle";
    detalle.textContent = dinero.format(p.precio) + " · Quedan " + p.cantidad;
    izquierda.append(nombre, detalle);

    const derecha = document.createElement("div");
    const enCarrito = carrito[p.id] || 0;

    if (p.cantidad <= 0) {
      derecha.className = "agotado";
      derecha.textContent = "Agotado";
    } else if (enCarrito === 0) {
      const agregar = document.createElement("button");
      agregar.type = "button";
      agregar.textContent = "Agregar";
      agregar.addEventListener("click", () => cambiarCantidad(p.id, 1, p.cantidad));
      derecha.appendChild(agregar);
    } else {
      derecha.className = "cantidad";

      const menos = document.createElement("button");
      menos.type = "button";
      menos.className = "paso secundario";
      menos.textContent = "−";
      menos.setAttribute("aria-label", "Quitar uno de " + p.nombre);
      menos.addEventListener("click", () => cambiarCantidad(p.id, -1, p.cantidad));

      const num = document.createElement("span");
      num.className = "num";
      num.textContent = enCarrito;

      const mas = document.createElement("button");
      mas.type = "button";
      mas.className = "paso";
      mas.textContent = "+";
      mas.setAttribute("aria-label", "Agregar uno de " + p.nombre);
      mas.disabled = enCarrito >= p.cantidad;
      mas.addEventListener("click", () => cambiarCantidad(p.id, 1, p.cantidad));

      derecha.append(menos, num, mas);
    }

    li.append(izquierda, derecha);
    lista.appendChild(li);
  }
}

$("buscar-venta").addEventListener("input", pintarVender);

// ---------- Contado o a crédito ----------
function ponerTipoDePago(credito) {
  aCredito = credito;
  $("pago-contado").classList.toggle("secundario", credito);
  $("pago-credito").classList.toggle("secundario", !credito);
  $("pago-contado").setAttribute("aria-pressed", String(!credito));
  $("pago-credito").setAttribute("aria-pressed", String(credito));
  $("bloque-cliente").hidden = !credito;
  aviso("msg-venta", "");
  actualizarCobro();
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

// ---------- Total y barra de cobro ----------
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
  $("cobro-detalle").textContent =
    cantidadTotal + (cantidadTotal === 1 ? " artículo" : " artículos") + (aCredito ? " · A crédito" : "");
  $("cobro-total").textContent = dinero.format(total);
}

// ---------- Cobrar ----------
$("btn-cobrar").addEventListener("click", async () => {
  const { total, items } = calcularCarrito();
  if (items.length === 0) return;

  const clienteId = $("sel-cliente").value ? Number($("sel-cliente").value) : null;
  if (aCredito && !clienteId) {
    aviso("msg-venta", "Elige un cliente para vender a crédito.", "error");
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
  aviso("msg-venta", "");

  // Esta función de Supabase guarda la venta y descuenta el inventario en un solo paso.
  const { error } = await db.rpc("registrar_venta", {
    items,
    p_cliente_id: aCredito ? clienteId : null,
    p_a_credito: aCredito,
  });
  boton.disabled = false;

  if (error) {
    const conocido = /inventario|no encontrado|cliente/i.test(error.message || "");
    aviso(
      "msg-venta",
      conocido
        ? error.message + ". Revisa la venta e intenta otra vez."
        : "No se pudo registrar la venta. Revisa tu internet e intenta otra vez.",
      "error"
    );
    await cargarProductos();
    window.scrollTo(0, 0);
    return;
  }

  carrito = {};
  $("buscar-venta").value = "";
  const detalleCredito = aCredito ? " (a crédito a " + cliente.nombre + ")" : "";
  $("sel-cliente").value = "";
  ponerTipoDePago(false);
  aviso("msg-venta", "Venta guardada ✓ Total: " + dinero.format(total) + detalleCredito, "ok");
  await Promise.all([cargarProductos(), cargarClientes()]);
  window.scrollTo(0, 0);
});
