// ===== pendientes.js: compras que todavía no se han pagado =====

let comprasSinPagar = []; // compras con pagada = false

async function cargarPendientesPago() {
  const { data, error } = await db
    .from("compras")
    .select("id, created_at, costo, compra_items(nombre, cantidad)")
    .eq("pagada", false)
    .order("created_at", { ascending: false });

  if (error) {
    aviso("msg-pendientes", "No se pudo cargar la lista. Revisa tu internet e intenta otra vez.", "error");
    return false;
  }

  comprasSinPagar = data;
  pintarPendientes();
  return true;
}

function pintarPendientes() {
  const n = comprasSinPagar.length;
  const total = redondear(comprasSinPagar.reduce((suma, c) => suma + Number(c.costo), 0));

  $("pendientes-total").textContent =
    "Pendiente de pago: " + dinero.format(total) + " (" + n + (n === 1 ? " compra)" : " compras)");
  $("ir-pendientes").textContent =
    n > 0 ? "Compras sin pagar (" + n + ") · " + dinero.format(total) : "Compras sin pagar";

  const lista = $("lista-pendientes");
  lista.replaceChildren();

  if (n === 0) {
    const vacio = document.createElement("li");
    vacio.className = "vacio";
    vacio.textContent = "No hay compras sin pagar ✓";
    lista.appendChild(vacio);
    return;
  }

  for (const c of comprasSinPagar) {
    const li = document.createElement("li");
    li.className = "item";

    const fila = document.createElement("div");
    fila.className = "fila-item";

    const izquierda = document.createElement("div");
    const titulo = document.createElement("div");
    titulo.className = "nombre";
    titulo.textContent = fechaCorta(c.created_at) + " · " + horaDe(c.created_at);
    const detalle = document.createElement("div");
    detalle.className = "detalle";
    detalle.textContent = c.compra_items.map((it) => it.cantidad + " × " + it.nombre).join(", ");
    izquierda.append(titulo, detalle);

    const costo = document.createElement("div");
    costo.className = "precio";
    costo.textContent = dinero.format(c.costo);

    fila.append(izquierda, costo);
    li.appendChild(fila);

    const pagar = document.createElement("button");
    pagar.type = "button";
    pagar.className = "secundario btn-mov";
    pagar.textContent = "Marcar como pagada";
    pagar.addEventListener("click", () => marcarPagada(c));
    li.appendChild(pagar);

    lista.appendChild(li);
  }
}

async function marcarPagada(c) {
  if (!window.confirm("¿Marcar como pagada la compra de " + dinero.format(c.costo) + "?")) return;

  const { error } = await db
    .from("compras")
    .update({ pagada: true, pagada_el: new Date().toISOString() })
    .eq("id", c.id);

  if (error) {
    aviso("msg-pendientes", "No se pudo marcar como pagada. Intenta otra vez.", "error");
    window.scrollTo(0, 0);
    return;
  }

  await cargarPendientesPago();
  aviso("msg-pendientes", "Compra marcada como pagada ✓", "ok");
  window.scrollTo(0, 0);
}

// Botón de la pantalla "Por comprar" que abre esta lista
$("ir-pendientes").addEventListener("click", async () => {
  aviso("msg-pendientes", "Cargando…");
  irA("pendientes");
  const bien = await cargarPendientesPago();
  if (bien) aviso("msg-pendientes", "");
});
