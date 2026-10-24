// ===== cuenta.js: estado de cuenta de cada cliente, mensaje de WhatsApp y datos de pago =====

let datosPago = { banco: "", titular: "", cuenta: "", nota: "" }; // tus datos para recibir depósitos
let cuentaActual = null;       // { cliente, pendientes, saldo } de la cuenta que se está viendo
let pagoVolverA = "clientes";  // a dónde regresa la pantalla de datos de pago

function fechaCorta(texto) {
  return new Date(texto).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

// ---------- Datos de pago ----------
async function cargarPago() {
  const { data, error } = await db
    .from("ajustes")
    .select("banco, titular, cuenta, nota")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return; // si falla, se quedan los datos que ya había
  datosPago = {
    banco: data.banco || "",
    titular: data.titular || "",
    cuenta: data.cuenta || "",
    nota: data.nota || "",
  };
}

function abrirPago(volverA) {
  pagoVolverA = volverA;
  $("pago-banco").value = datosPago.banco;
  $("pago-titular").value = datosPago.titular;
  $("pago-cuenta").value = datosPago.cuenta;
  $("pago-nota").value = datosPago.nota;
  aviso("msg-pago", "");
  irA("pago");
}

$("ir-pago").addEventListener("click", () => abrirPago("clientes"));
$("ir-pago-cuenta").addEventListener("click", () => abrirPago("cuenta"));

$("volver-pago").addEventListener("click", () => {
  if (pagoVolverA === "cuenta" && cuentaActual) {
    pintarCuenta();
    irA("cuenta");
  } else {
    irA("clientes");
  }
});

$("form-pago").addEventListener("submit", async (e) => {
  e.preventDefault();
  const boton = $("btn-guardar-pago");
  boton.disabled = true;

  const nuevos = {
    banco: $("pago-banco").value.trim(),
    titular: $("pago-titular").value.trim(),
    cuenta: $("pago-cuenta").value.trim(),
    nota: $("pago-nota").value.trim(),
  };
  const { error } = await db.from("ajustes").upsert({ id: 1, ...nuevos });
  boton.disabled = false;

  if (error) {
    aviso("msg-pago", "No se pudieron guardar los datos. Intenta otra vez.", "error");
    return;
  }

  datosPago = nuevos;
  aviso("msg-pago", "Datos de pago guardados ✓", "ok");
});

// ---------- Estado de cuenta ----------
async function abrirCuenta(c) {
  aviso("msg-clientes", "Cargando cuenta…");

  const [ventasRes, abonosRes] = await Promise.all([
    db
      .from("ventas")
      .select("id, created_at, total, es_saldo_anterior, venta_items(nombre, precio, cantidad)")
      .eq("cliente_id", c.id)
      .eq("a_credito", true)
      .order("created_at", { ascending: true }),
    db
      .from("abonos")
      .select("id, created_at, monto")
      .eq("cliente_id", c.id)
      .order("created_at", { ascending: true }),
  ]);

  if (ventasRes.error || abonosRes.error) {
    aviso("msg-clientes", "No se pudo cargar la cuenta. Revisa tu internet e intenta otra vez.", "error");
    return;
  }
  aviso("msg-clientes", "");

  // Juntamos compras y abonos en orden, con el saldo después de cada movimiento
  const movimientos = [
    ...ventasRes.data.map((v) => ({
      tipo: "compra",
      anterior: v.es_saldo_anterior,
      fecha: v.created_at,
      monto: Number(v.total),
      items: v.venta_items,
    })),
    ...abonosRes.data.map((a) => ({
      tipo: "abono",
      fecha: a.created_at,
      monto: -Number(a.monto),
      items: [],
    })),
  ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  // Cada vez que el saldo llega a cero, la cuenta se liquidó: lo anterior ya no se muestra.
  // (Todo sigue guardado en el Historial.)
  let saldo = 0;
  let inicio = 0;
  movimientos.forEach((m, i) => {
    saldo += m.monto;
    m.saldo = saldo;
    if (redondear(saldo) <= 0) inicio = i + 1;
  });

  cuentaActual = {
    cliente: c,
    pendientes: movimientos.slice(inicio),
    saldo: Math.max(redondear(saldo), 0),
  };
  pintarCuenta();
  irA("cuenta");
}

function pintarCuenta() {
  const { cliente, pendientes, saldo } = cuentaActual;

  $("cuenta-nombre").textContent = cliente.nombre;
  $("cuenta-saldo").textContent = dinero.format(saldo);

  const lista = $("lista-cuenta");
  lista.replaceChildren();

  if (pendientes.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "vacio";
    vacio.textContent = "No hay movimientos pendientes. La cuenta está al corriente ✓";
    lista.appendChild(vacio);
  }

  for (const m of pendientes) {
    const li = document.createElement("li");
    li.className = "item";

    const fila = document.createElement("div");
    fila.className = "fila-item";

    const izquierda = document.createElement("div");
    const titulo = document.createElement("div");
    titulo.className = "nombre";
    const nombreMovimiento = m.tipo === "abono" ? "Abono" : (m.anterior ? "Saldo anterior" : "Compra");
    titulo.textContent = fechaCorta(m.fecha) + " · " + nombreMovimiento;
    const detalle = document.createElement("div");
    detalle.className = "detalle";
    detalle.textContent = "Saldo: " + dinero.format(Math.max(redondear(m.saldo), 0));
    izquierda.append(titulo, detalle);

    const monto = document.createElement("div");
    monto.className = m.tipo === "compra" ? "saldo debe" : "saldo limpio";
    monto.textContent = (m.tipo === "compra" ? "+" : "−") + dinero.format(Math.abs(m.monto));

    fila.append(izquierda, monto);
    li.appendChild(fila);

    for (const it of m.items) {
      const linea = document.createElement("div");
      linea.className = "linea";
      linea.textContent = it.cantidad + " × " + it.nombre + " (" + dinero.format(it.precio) + ")";
      li.appendChild(linea);
    }

    lista.appendChild(li);
  }

  const hayPago = datosPago.banco || datosPago.titular || datosPago.cuenta;
  $("aviso-pago").hidden = Boolean(hayPago);
  $("copiar-cuenta").disabled = pendientes.length === 0;
  aviso("msg-cuenta", "");
}

// ---------- Mensaje para WhatsApp ----------
function textoParaWhatsApp() {
  const { cliente, pendientes, saldo } = cuentaActual;
  const lineas = [];

  lineas.push("Hola " + cliente.nombre + ", este es el resumen de tu cuenta.");
  lineas.push("");
  lineas.push("Saldo de la tienda: " + dinero.format(saldo));
  lineas.push("");
  lineas.push("Movimientos:");
  for (const m of pendientes) {
    if (m.tipo === "compra" && m.anterior) {
      lineas.push("• " + fechaCorta(m.fecha) + " Saldo anterior: " + dinero.format(m.monto));
    } else if (m.tipo === "compra") {
      const productosTexto = m.items.map((it) => it.cantidad + " × " + it.nombre).join(", ");
      lineas.push("• " + fechaCorta(m.fecha) + " Compra: " + productosTexto + " = " + dinero.format(m.monto));
    } else {
      lineas.push("• " + fechaCorta(m.fecha) + " Abono: −" + dinero.format(-m.monto));
    }
  }

  if (datosPago.banco || datosPago.titular || datosPago.cuenta || datosPago.nota) {
    lineas.push("");
    lineas.push("Para depositar:");
    if (datosPago.banco) lineas.push("Banco: " + datosPago.banco);
    if (datosPago.titular) lineas.push("A nombre de: " + datosPago.titular);
    if (datosPago.cuenta) lineas.push("Cuenta o CLABE: " + datosPago.cuenta);
    if (datosPago.nota) lineas.push(datosPago.nota);
  }

  return lineas.join("\n");
}

$("copiar-cuenta").addEventListener("click", async () => {
  if (!cuentaActual || cuentaActual.pendientes.length === 0) return;
  try {
    await navigator.clipboard.writeText(textoParaWhatsApp());
    aviso("msg-cuenta", "Mensaje copiado ✓ Ya puedes pegarlo en WhatsApp.", "ok");
  } catch (err) {
    aviso("msg-cuenta", "No se pudo copiar el mensaje. Intenta otra vez.", "error");
  }
});

$("volver-cuenta").addEventListener("click", () => irA("clientes"));
