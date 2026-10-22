// ===== comprar.js: lista de productos por comprar y registro de compras =====

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
    if (!lista.some((p) => String(p.id) === id)) delete compras[id];
  }

  const ul = $("lista-comprar");
  ul.replaceChildren();
  $("guardar-compras").hidden = lista.length === 0;

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

    ul.appendChild(li);
  }
}

$("ir-comprar").addEventListener("click", () => {
  aviso("msg-comprar", "");
  irA("comprar");
});
$("volver-comprar").addEventListener("click", () => irA("productos"));

// Llena cada casilla con lo que falta para llegar al mínimo
$("llenar-faltantes").addEventListener("click", () => {
  for (const p of productosPorComprar()) {
    if (p.faltan > 0) compras[p.id] = String(p.faltan);
  }
  aviso("msg-comprar", "");
  pintarComprar();
});

// Guarda todas las compras escritas, de una sola vez
$("guardar-compras").addEventListener("click", async () => {
  const items = [];
  for (const [id, texto] of Object.entries(compras)) {
    const cantidad = parseInt(texto, 10);
    if (cantidad > 0) items.push({ producto_id: Number(id), cantidad });
  }

  if (items.length === 0) {
    aviso("msg-comprar", "Escribe cuántas piezas compraste de al menos un producto.", "error");
    window.scrollTo(0, 0);
    return;
  }

  const boton = $("guardar-compras");
  boton.disabled = true;
  aviso("msg-comprar", "Guardando…");

  // Esta función de Supabase suma todas las cantidades al inventario en un solo paso.
  const { error } = await db.rpc("sumar_inventario", { items });
  boton.disabled = false;

  if (error) {
    aviso("msg-comprar", "No se pudieron guardar las compras. Intenta otra vez.", "error");
    window.scrollTo(0, 0);
    return;
  }

  compras = {};
  await cargarProductos();

  const siguen = items.filter((i) => productosPorComprar().some((p) => p.id === i.producto_id)).length;
  let texto = "Compras guardadas ✓ " + items.length + (items.length === 1 ? " producto actualizado." : " productos actualizados.");
  if (siguen > 0) {
    texto += " " + siguen + (siguen === 1 ? " sigue" : " siguen") + " en la lista porque aún no llega al mínimo.";
  }
  aviso("msg-comprar", texto, "ok");
  window.scrollTo(0, 0);
});

// Copia la lista para pegarla en WhatsApp u otra app
$("copiar-lista").addEventListener("click", async () => {
  const lista = productosPorComprar();
  if (lista.length === 0) {
    aviso("msg-comprar", "No hay nada por comprar.", "ok");
    return;
  }

  const lineas = lista.map((p) => "• " + p.nombre + (p.faltan > 0 ? ": " + p.faltan : ""));
  const texto = "Por comprar:\n" + lineas.join("\n");

  try {
    await navigator.clipboard.writeText(texto);
    aviso("msg-comprar", "Lista copiada ✓ Ya puedes pegarla en WhatsApp.", "ok");
  } catch (err) {
    aviso("msg-comprar", "No se pudo copiar la lista. Cópiala a mano desde la pantalla.", "error");
  }
});
