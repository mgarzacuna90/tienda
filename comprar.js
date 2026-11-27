// ===== comprar.js: lista de productos por comprar y registro de compras =====

let fechasCaducidad = {}; // fecha de caducidad escrita para cada producto con caducidad: { idProducto: "AAAA-MM-DD" }

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

  const ul = $("lista-comprar");
  ul.replaceChildren();
  $("guardar-compras").hidden = lista.length === 0;
  $("datos-compra").hidden = lista.length === 0;

  if (lista.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "vacio";
    vacio.textContent = "Todo en orden: no hay productos por comprar.";
    ul.appendChild(vacio);
    return;
  }

  for (const p of lista) {
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
    detalle.className = "detalle inv-bajo";
    detalle.textContent = "Inventario: " + p.cantidad + (p.minimo > 0 ? " · Mínimo: " + p.minimo : "");
    textos.append(nombre, detalle);
    izquierda.append(crearMiniatura(p, "foto-chica"), textos);

    const faltan = document.createElement("div");
    faltan.className = "precio";
    faltan.textContent = p.faltan > 0 ? "Faltan " + p.faltan : "Sin inventario";

    fila.append(izquierda, faltan);
    li.appendChild(fila);

    const campo = document.createElement("input");
    campo.type = "number";
    campo.inputMode = "numeric";
    campo.min = "1";
    campo.step = "1";
    campo.className = "campo-compra";
    campo.placeholder = "¿Cuántos compraste?";
    campo.setAttribute("aria-label", "Cantidad que compraste de " + p.nombre);
    campo.value = compras[p.id] || "";
    campo.addEventListener("input", () => {
      if (campo.value) compras[p.id] = campo.value;
      else delete compras[p.id];
    });
    li.appendChild(campo);

    // Los productos con caducidad piden la fecha de lo que se compró (cada compra es un lote)
    if (p.tiene_caducidad) {
      const etiqueta = document.createElement("label");
      etiqueta.className = "etiqueta-fecha";
      etiqueta.htmlFor = "fecha-compra-" + p.id;
      etiqueta.textContent = "Fecha de caducidad de lo que compraste";
      const fecha = document.createElement("input");
      fecha.type = "date";
      fecha.id = "fecha-compra-" + p.id;
      fecha.className = "campo-compra";
      fecha.value = fechasCaducidad[p.id] || "";
      fecha.addEventListener("input", () => {
        if (fecha.value) fechasCaducidad[p.id] = fecha.value;
        else delete fechasCaducidad[p.id];
      });
      li.append(etiqueta, fecha);
    }

    ul.appendChild(li);
  }
}

$("ir-comprar").addEventListener("click", () => {
  aviso("msg-comprar", "");
  cerrarDestinatarios();
  irA("comprar");
});

// Llena cada casilla con lo que falta para llegar al mínimo
$("llenar-faltantes").addEventListener("click", () => {
  for (const p of productosPorComprar()) {
    if (p.faltan > 0) compras[p.id] = String(p.faltan);
  }
  aviso("msg-comprar", "");
  pintarComprar();
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

  // Cada compra de un producto con caducidad necesita su fecha: forma un lote nuevo
  for (const it of items) {
    const prod = productos.find((x) => x.id === it.producto_id);
    if (prod && prod.tiene_caducidad) {
      if (!fechasCaducidad[it.producto_id]) {
        aviso("msg-comprar", "Escribe la fecha de caducidad de " + prod.nombre + ".", "error");
        window.scrollTo(0, 0);
        return;
      }
      it.caduca = fechasCaducidad[it.producto_id];
    }
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
