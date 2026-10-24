// ===== deudas.js: cargar las deudas que los clientes traen de otra aplicación =====

// Registramos esta pantalla en la navegación (solo el dueño puede entrar)
vistas.deudas = $("vista-deudas");
PESTANA.deudas = "clientes";

let deudasOriginales = {}; // { idCliente: monto que ya estaba guardado como saldo anterior }
let deudasEscritas = {};   // { idCliente: texto escrito en la casilla }

async function cargarDeudasAnteriores() {
  const { data, error } = await db
    .from("ventas")
    .select("cliente_id, total")
    .eq("es_saldo_anterior", true);

  if (error) {
    aviso("msg-deudas", "No se pudieron cargar las deudas. Revisa tu internet e intenta otra vez.", "error");
    return false;
  }

  deudasOriginales = {};
  for (const fila of data) {
    deudasOriginales[fila.cliente_id] = (deudasOriginales[fila.cliente_id] || 0) + redondear(fila.total);
  }
  deudasEscritas = {};
  pintarDeudas();
  return true;
}

function pintarDeudas() {
  const lista = $("lista-deudas");
  lista.replaceChildren();

  if (clientes.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "vacio";
    vacio.textContent = "Primero agrega a tus clientes con el botón Nuevo cliente.";
    lista.appendChild(vacio);
    return;
  }

  for (const c of clientes) {
    const li = document.createElement("li");
    li.className = "item";

    const fila = document.createElement("div");
    fila.className = "fila-item";

    const izquierda = document.createElement("div");
    const nombre = document.createElement("div");
    nombre.className = "nombre";
    nombre.textContent = c.nombre;
    const detalle = document.createElement("div");
    detalle.className = "detalle";
    detalle.textContent = "Debe ahora: " + dinero.format(c.saldo > 0 ? c.saldo : 0);
    izquierda.append(nombre, detalle);

    const campo = document.createElement("input");
    campo.type = "number";
    campo.inputMode = "numeric";
    campo.min = "0";
    campo.step = "1";
    campo.placeholder = "0";
    campo.setAttribute("aria-label", "Deuda anterior de " + c.nombre);
    campo.style.width = "7.5rem";
    campo.style.margin = "0";
    campo.style.textAlign = "right";
    campo.value = deudasEscritas[c.id] !== undefined
      ? deudasEscritas[c.id]
      : (deudasOriginales[c.id] ? String(deudasOriginales[c.id]) : "");
    campo.addEventListener("input", () => {
      deudasEscritas[c.id] = campo.value;
    });

    fila.append(izquierda, campo);
    li.appendChild(fila);
    lista.appendChild(li);
  }
}

$("ir-deudas").addEventListener("click", async () => {
  aviso("msg-deudas", "Cargando…");
  irA("deudas");
  const bien = await cargarDeudasAnteriores();
  if (bien) aviso("msg-deudas", "");
});

$("volver-deudas").addEventListener("click", () => irA("clientes"));

// Guarda todas las deudas escritas, de una sola vez
$("guardar-deudas").addEventListener("click", async () => {
  const items = [];
  for (const c of clientes) {
    const escrito = deudasEscritas[c.id];
    if (escrito === undefined) continue; // no tocó esa casilla

    const nuevo = escrito === "" ? 0 : redondear(escrito);
    if (!(nuevo >= 0)) {
      aviso("msg-deudas", "Revisa las cantidades: deben ser números de cero en adelante.", "error");
      window.scrollTo(0, 0);
      return;
    }

    const antes = deudasOriginales[c.id] || 0;
    if (nuevo !== antes) items.push({ cliente_id: c.id, monto: nuevo });
  }

  if (items.length === 0) {
    aviso("msg-deudas", "No hay cambios que guardar.", "error");
    window.scrollTo(0, 0);
    return;
  }

  const texto = items.length === 1 ? "1 cliente" : items.length + " clientes";
  if (!window.confirm("Se guardará la deuda anterior de " + texto + ". ¿Continuar?")) return;

  const boton = $("guardar-deudas");
  boton.disabled = true;
  aviso("msg-deudas", "Guardando…");

  // Esta función de Supabase guarda todas las deudas en un solo paso.
  const { error } = await db.rpc("fijar_deudas_anteriores", { items });
  boton.disabled = false;

  if (error) {
    aviso("msg-deudas", "No se pudieron guardar las deudas. Intenta otra vez.", "error");
    window.scrollTo(0, 0);
    return;
  }

  await cargarClientes();
  await cargarDeudasAnteriores();
  aviso("msg-deudas", "Deudas guardadas ✓ " + texto + (items.length === 1 ? " actualizado." : " actualizados."), "ok");
  window.scrollTo(0, 0);
});
