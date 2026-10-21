// ===== comprar.js: lista de productos por comprar (inventario bajo) =====

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

  const ul = $("lista-comprar");
  ul.replaceChildren();

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
    ul.appendChild(li);
  }
}

$("ir-comprar").addEventListener("click", () => {
  aviso("msg-comprar", "");
  irA("comprar");
});
$("volver-comprar").addEventListener("click", () => irA("productos"));

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
