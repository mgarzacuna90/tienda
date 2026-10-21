// ===== historial.js: historial de ventas y abonos por día =====

// Fecha de hoy como texto AAAA-MM-DD (en la hora de tu celular)
function hoyTexto() {
  const f = new Date();
  const mes = String(f.getMonth() + 1).padStart(2, "0");
  const dia = String(f.getDate()).padStart(2, "0");
  return f.getFullYear() + "-" + mes + "-" + dia;
}

// Del día elegido: desde las 00:00 hasta las 00:00 del día siguiente
function limitesDelDia(texto) {
  const [anio, mes, dia] = texto.split("-").map(Number);
  const inicio = new Date(anio, mes - 1, dia, 0, 0, 0);
  const fin = new Date(anio, mes - 1, dia + 1, 0, 0, 0);
  return { inicio: inicio.toISOString(), fin: fin.toISOString() };
}

function horaDe(texto) {
  return new Date(texto).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

async function cargarHistorial() {
  const dia = $("fecha-historial").value || hoyTexto();
  const { inicio, fin } = limitesDelDia(dia);
  aviso("msg-historial", "Cargando…");

  const [ventasRes, abonosRes] = await Promise.all([
    db
      .from("ventas")
      .select("id, created_at, total, a_credito, clientes(nombre), venta_items(nombre, precio, cantidad)")
      .gte("created_at", inicio)
      .lt("created_at", fin)
      .order("created_at", { ascending: false }),
    db
      .from("abonos")
      .select("id, created_at, monto, clientes(nombre)")
      .gte("created_at", inicio)
      .lt("created_at", fin)
      .order("created_at", { ascending: false }),
  ]);

  if (ventasRes.error || abonosRes.error) {
    aviso("msg-historial", "No se pudo cargar el historial. Revisa tu internet e intenta otra vez.", "error");
    return;
  }

  aviso("msg-historial", "");
  pintarHistorial(ventasRes.data, abonosRes.data);
}

function pintarHistorial(ventas, abonos) {
  // ----- Resumen del día -----
  let total = 0;
  let contado = 0;
  let credito = 0;
  for (const v of ventas) {
    total += Number(v.total);
    if (v.a_credito) credito += Number(v.total);
    else contado += Number(v.total);
  }
  const abonosTotal = abonos.reduce((suma, a) => suma + Number(a.monto), 0);

  $("res-num").textContent = ventas.length;
  $("res-total").textContent = dinero.format(redondear(total));
  $("res-contado").textContent = dinero.format(redondear(contado));
  $("res-credito").textContent = dinero.format(redondear(credito));
  $("res-abonos").textContent = dinero.format(redondear(abonosTotal));
  $("res-recibido").textContent = dinero.format(redondear(contado + abonosTotal));

  // ----- Lista de ventas -----
  const listaVentas = $("lista-ventas-dia");
  listaVentas.replaceChildren();

  if (ventas.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "vacio";
    vacio.textContent = "No hubo ventas este día.";
    listaVentas.appendChild(vacio);
  }

  for (const v of ventas) {
    const li = document.createElement("li");
    li.className = "item";

    const fila = document.createElement("div");
    fila.className = "fila-item";

    const izquierda = document.createElement("div");
    const titulo = document.createElement("div");
    titulo.className = "nombre";
    titulo.textContent = horaDe(v.created_at);
    const tipo = document.createElement("div");
    tipo.className = v.a_credito ? "detalle etiqueta-credito" : "detalle";
    tipo.textContent = v.a_credito
      ? "A crédito" + (v.clientes ? " · " + v.clientes.nombre : "")
      : "Contado";
    izquierda.append(titulo, tipo);

    const monto = document.createElement("div");
    monto.className = "precio";
    monto.textContent = dinero.format(v.total);

    fila.append(izquierda, monto);
    li.appendChild(fila);

    for (const it of v.venta_items) {
      const linea = document.createElement("div");
      linea.className = "linea";
      linea.textContent = it.cantidad + " × " + it.nombre + " (" + dinero.format(it.precio) + ")";
      li.appendChild(linea);
    }

    listaVentas.appendChild(li);
  }

  // ----- Lista de abonos -----
  const listaAbonos = $("lista-abonos-dia");
  listaAbonos.replaceChildren();

  if (abonos.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "vacio";
    vacio.textContent = "No hubo abonos este día.";
    listaAbonos.appendChild(vacio);
  }

  for (const a of abonos) {
    const li = document.createElement("li");
    li.className = "item";

    const fila = document.createElement("div");
    fila.className = "fila-item";

    const izquierda = document.createElement("div");
    const nombre = document.createElement("div");
    nombre.className = "nombre";
    nombre.textContent = a.clientes ? a.clientes.nombre : "Cliente";
    const detalle = document.createElement("div");
    detalle.className = "detalle";
    detalle.textContent = horaDe(a.created_at);
    izquierda.append(nombre, detalle);

    const monto = document.createElement("div");
    monto.className = "precio";
    monto.textContent = dinero.format(a.monto);

    fila.append(izquierda, monto);
    li.appendChild(fila);
    listaAbonos.appendChild(li);
  }
}

// ---------- Botones y fecha ----------
$("fecha-historial").value = hoyTexto();
$("fecha-historial").addEventListener("change", cargarHistorial);

$("ir-historial").addEventListener("click", () => {
  $("fecha-historial").value = hoyTexto();
  irA("historial");
  cargarHistorial();
});

$("volver-historial").addEventListener("click", () => irA("vender"));
