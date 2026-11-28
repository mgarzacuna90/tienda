// ===== comprar.js: lista de productos por comprar y registro de compras =====

let fechasCaducidad = {}; // fecha de caducidad escrita para cada producto comprado: { idProducto: "AAAA-MM-DD" }

// "AAAA-MM-DD" -> "15 dic 2026"
function textoFechaCorta(texto) {
  const [anio, mes, dia] = texto.split("-").map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

function productosPorComprar() {
  return productos
    .filter(estaBajo)
    .map((p) => ({ ...p, faltan: Math.max(p.minimo - p.cantidad, 0) }))
    .sort((a, b) => b.faltan - a.faltan || a.nombre.localeCompare(b.nombre));
}

function pintarComprar() {
  const lista = productosPorComprar();

  // Contador en el botón de la pantalla Productos
  $("ir-comprar").textContent = lista.length > 0 ? "Por comprar (" + lista.length + ")" : "Por comprar";

  // Si un producto ya salió de la lista, olvidamos lo que se había escrito de él
  for (const id of Object.keys(compras)) {
    if (!lista.some((p) => String(p.id) === id)) {
      delete compras[id];
      delete fechasCaducidad[id];
    }
  }

  const contenedor = $("lista-comprar");
  contenedor.replaceChildren();
  $("guardar-compras").hidden = lista.length === 0;
  $("datos-compra").hidden = lista.length === 0;

  if (lista.length === 0) {
    const vacio = document.createElement("p");
    vacio.className = "vacio";
    vacio.textContent = "Todo en orden: no hay productos por comprar.";
    contenedor.appendChild(vacio);
    return;
  }

  // Tabla: Producto | Inventario | Comprados | Caducidad
  const tabla = document.createElement("table");
  tabla.className = "tabla-comprar";
  const columnas = document.createElement("colgroup");
  for (const ancho of ["19%", "20%", "19%", "42%"]) {
    const col = document.createElement("col");
    col.style.width = ancho;
    columnas.appendChild(col);
  }
  tabla.appendChild(columnas);
  const encabezado = document.createElement("tr");
  for (const [titulo, clase] of [["Producto", ""], ["Inventario", "num"], ["Comprados", "num"], ["Caducidad", ""]]) {
    const th = document.createElement("th");
    th.textContent = titulo;
    if (clase) th.className = clase;
    encabezado.appendChild(th);
  }
  const cabeza = document.createElement("thead");
  cabeza.appendChild(encabezado);
  tabla.appendChild(cabeza);

  const cuerpo = document.createElement("tbody");
  for (const p of lista) {
    const fila = document.createElement("tr");

    const celdaNombre = document.createElement("td");
    celdaNombre.textContent = p.nombre;

    const celdaInventario = document.createElement("td");
    celdaInventario.className = "num" + (p.cantidad <= 0 ? " inv-cero" : "");
    celdaInventario.textContent = String(p.cantidad);

    // Comprados: lo que se compró de este producto
    const celdaComprados = document.createElement("td");
    const campo = document.createElement("input");
    campo.type = "number";
    campo.inputMode = "numeric";
    campo.min = "1";
    campo.step = "1";
    campo.setAttribute("aria-label", "Cantidad que compraste de " + p.nombre);
    campo.value = compras[p.id] || "";
    campo.addEventListener("input", () => {
      if (campo.value) compras[p.id] = campo.value;
      else delete compras[p.id];
    });
    celdaComprados.appendChild(campo);

    // Caducidad: la fecha de lo que se compró; reemplaza a la anterior (que se muestra en gris)
    const celdaCaducidad = document.createElement("td");
    const fecha = document.createElement("input");
    fecha.type = "date";
    fecha.id = "fecha-compra-" + p.id;
    fecha.setAttribute("aria-label", "Fecha de caducidad de lo que compraste de " + p.nombre);
    fecha.value = fechasCaducidad[p.id] || "";
    fecha.addEventListener("input", () => {
      if (fecha.value) fechasCaducidad[p.id] = fecha.value;
      else delete fechasCaducidad[p.id];
    });
    celdaCaducidad.appendChild(fecha);
    if (p.caduca) {
      const antes = document.createElement("div");
      antes.className = "fecha-anterior";
      antes.textContent = "Antes: " + textoFechaCorta(p.caduca);
      celdaCaducidad.appendChild(antes);
    }

    fila.append(celdaNombre, celdaInventario, celdaComprados, celdaCaducidad);
    cuerpo.appendChild(fila);
  }
  tabla.appendChild(cuerpo);
  contenedor.appendChild(tabla);
}

$("ir-comprar").addEventListener("click", () => {
  aviso("msg-comprar", "");
  cerrarDestinatarios();
  irA("comprar");
});

// ---------- ¿Ya se pagó la compra? ----------
let compraPagada = null; // null = sin elegir, true = sí, false = no

function ponerPagada(valor) {
  compraPagada = valor;
  $("pagada-si").classList.toggle("secundario", valor !== true);
  $("pagada-no").classList.toggle("secundario", valor !== false);
  $("pagada-si").setAttribute("aria-pressed", String(valor === true));
  $("pagada-no").setAttribute("aria-pressed", String(valor === false));
}

$("pagada-si").addEventListener("click", () => ponerPagada(true));
$("pagada-no").addEventListener("click", () => ponerPagada(false));

// Guarda todas las compras escritas, de una sola vez, con su costo
$("guardar-compras").addEventListener("click", async () => {
  const items = [];
  for (const [id, texto] of Object.entries(compras)) {
    const cantidad = parseInt(texto, 10);
    if (cantidad > 0) items.push({ producto_id: Number(id), cantidad });
  }

  // Todos los productos caducan: cada compra lleva su fecha, que reemplaza a la anterior
  for (const it of items) {
    if (!fechasCaducidad[it.producto_id]) {
      const prod = productos.find((x) => x.id === it.producto_id);
      aviso("msg-comprar", "Escribe la fecha de caducidad de " + (prod ? prod.nombre : "cada producto") + ".", "error");
      window.scrollTo(0, 0);
      return;
    }
    it.caduca = fechasCaducidad[it.producto_id];
  }

  if (items.length === 0) {
    aviso("msg-comprar", "Escribe cuántas piezas compraste de al menos un producto.", "error");
    window.scrollTo(0, 0);
    return;
  }

  const costoTexto = $("compra-costo").value;
  if (costoTexto === "" || !(redondear(costoTexto) >= 0)) {
    aviso("msg-comprar", "Escribe cuánto costó la compra en total.", "error");
    window.scrollTo(0, 0);
    return;
  }
  if (compraPagada === null) {
    aviso("msg-comprar", "Elige si ya se pagó la compra: Sí o No.", "error");
    window.scrollTo(0, 0);
    return;
  }

  const costo = redondear(costoTexto);
  const pagada = compraPagada;

  const boton = $("guardar-compras");
  boton.disabled = true;
  aviso("msg-comprar", "Guardando…");

  // Esta función de Supabase suma las cantidades al inventario y guarda la compra, en un solo paso.
  const { error } = await db.rpc("registrar_compra", { items, p_costo: costo, p_pagada: pagada });
  boton.disabled = false;

  if (error) {
    aviso("msg-comprar", "No se pudieron guardar las compras. Intenta otra vez.", "error");
    window.scrollTo(0, 0);
    return;
  }

  compras = {};
  fechasCaducidad = {};
  $("compra-costo").value = "";
  ponerPagada(null);
  await cargarProductos();
  await cargarPendientesPago();

  const siguen = items.filter((i) => productosPorComprar().some((p) => p.id === i.producto_id)).length;
  let texto = "Compras guardadas ✓ " + items.length + (items.length === 1 ? " producto actualizado." : " productos actualizados.");
  if (siguen > 0) {
    texto += " " + siguen + (siguen === 1 ? " sigue" : " siguen") + " en la lista porque aún no llega al mínimo.";
  }

  if (pagada) {
    aviso("msg-comprar", texto + " Costo: " + dinero.format(costo) + ", ya pagada.", "ok");
    window.scrollTo(0, 0);
  } else {
    // Si no se ha pagado, se muestra la lista de compras sin pagar
    aviso("msg-pendientes", "Compra guardada ✓ Quedó pendiente de pago por " + dinero.format(costo) + ".", "ok");
    irA("pendientes");
  }
});

// ---------- Enviar la lista por WhatsApp ----------
function textoLista() {
  const lineas = productosPorComprar().map((p) => "• " + p.nombre + (p.faltan > 0 ? ": " + p.faltan : ""));
  return "Por comprar:\n" + lineas.join("\n");
}

function cerrarDestinatarios() {
  $("elegir-destinatario").hidden = true;
}

// Muestra a quién se le puede enviar la lista.
// Los destinatarios viven en Supabase (tabla destinatarios_lista) y solo el dueño puede leerlos.
$("enviar-lista").addEventListener("click", async () => {
  if (productosPorComprar().length === 0) {
    aviso("msg-comprar", "No hay nada por comprar.", "ok");
    return;
  }
  aviso("msg-comprar", "");

  const { data: destinatarios, error } = await db
    .from("destinatarios_lista")
    .select("nombre, telefono")
    .eq("activo", true)
    .order("orden");

  if (error || !destinatarios || destinatarios.length === 0) {
    aviso("msg-comprar", "No se pudieron cargar los destinatarios. Intenta otra vez.", "error");
    window.scrollTo(0, 0);
    return;
  }

  const botones = $("botones-destinatario");
  botones.replaceChildren();
  for (const persona of destinatarios) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "grande";
    boton.style.marginBottom = "0.5rem";
    boton.textContent = persona.nombre;
    boton.addEventListener("click", () => {
      cerrarDestinatarios();
      window.open(enlaceWhatsApp(persona.telefono, textoLista()), "_blank");
      aviso("msg-comprar", "Abriendo WhatsApp con la lista para " + persona.nombre + "…", "ok");
    });
    botones.appendChild(boton);
  }

  $("elegir-destinatario").hidden = false;
});

$("cancelar-destinatario").addEventListener("click", cerrarDestinatarios);
