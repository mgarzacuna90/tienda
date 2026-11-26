// ===== porcliente.js: compras a crédito por cliente en un año (solo dueño) =====

let pedidoPorCliente = 0; // número del último pedido: así se ignoran respuestas viejas

// Años para elegir: el actual y los 4 anteriores
function llenarAnios() {
  const lista = $("sel-anio");
  if (lista.options.length > 0) return;
  const actual = new Date().getFullYear();
  for (let a = actual; a >= actual - 4; a--) {
    const opcion = document.createElement("option");
    opcion.value = String(a);
    opcion.textContent = String(a);
    lista.appendChild(opcion);
  }
}

function limitesDelAnio(anio) {
  return { inicio: new Date(anio, 0, 1), fin: new Date(anio + 1, 0, 1) };
}

// Muestra u oculta las compras de un cliente; las pide a Supabase la primera vez
async function alternarCompras(fila, anio, boton, caja) {
  if (!caja.hidden) {
    caja.hidden = true;
    boton.textContent = "Ver compras";
    return;
  }
  boton.textContent = "Ocultar compras";
  caja.hidden = false;
  if (caja.dataset.cargado === "si") return;

  caja.textContent = "Cargando…";
  const { inicio, fin } = limitesDelAnio(anio);
  const { data, error } = await db
    .from("ventas")
    .select("id, created_at, total, venta_items(nombre, cantidad)")
    .eq("cliente_id", fila.id_cliente)
    .eq("a_credito", true)
    .eq("es_saldo_anterior", false)
    .gte("created_at", inicio.toISOString())
    .lt("created_at", fin.toISOString())
    .order("created_at", { ascending: false });

  caja.replaceChildren();
  if (error || !data) {
    caja.textContent = "No se pudieron cargar las compras. Intenta otra vez.";
    boton.textContent = "Ver compras";
    return;
  }
  caja.dataset.cargado = "si";
  for (const v of data) {
    const linea = document.createElement("div");
    linea.className = "linea-compra";
    const encabezado = document.createElement("strong");
    encabezado.textContent = corto(new Date(v.created_at)) + " · " + dinero.format(redondear(v.total));
    const productos = document.createElement("div");
    productos.className = "detalle";
    productos.textContent = (v.venta_items || []).map((i) => i.cantidad + " × " + i.nombre).join(" · ");
    linea.append(encabezado, productos);
    caja.appendChild(linea);
  }
}

function pintarPorCliente(filas, anio) {
  const lista = $("lista-porcliente");
  lista.replaceChildren();

  const total = filas.reduce((suma, f) => suma + Number(f.total_comprado), 0);
  $("porcliente-total").textContent =
    "Total de " + anio + ": " + dinero.format(redondear(total)) + " (" + filas.length + " clientes)";

  if (filas.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "vacio";
    vacio.textContent = "Ningún cliente compró a crédito en este año.";
    lista.appendChild(vacio);
    return;
  }

  for (const f of filas) {
    const li = document.createElement("li");
    li.className = "item";

    const fila = document.createElement("div");
    fila.className = "fila-item";
    const izquierda = document.createElement("div");
    const nombre = document.createElement("div");
    nombre.className = "nombre";
    nombre.textContent = f.nombre_cliente;
    const compras = document.createElement("div");
    compras.className = "detalle";
    compras.textContent = Number(f.num_compras) === 1 ? "1 compra" : Number(f.num_compras) + " compras";
    izquierda.append(nombre, compras);
    const monto = document.createElement("strong");
    monto.textContent = dinero.format(redondear(f.total_comprado));
    fila.append(izquierda, monto);
    li.appendChild(fila);

    const acciones = document.createElement("div");
    acciones.className = "acciones-fila";
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "secundario";
    boton.textContent = "Ver compras";
    acciones.appendChild(boton);
    li.appendChild(acciones);

    const caja = document.createElement("div");
    caja.className = "detalle-compras";
    caja.hidden = true;
    li.appendChild(caja);

    boton.addEventListener("click", () => alternarCompras(f, anio, boton, caja));
    lista.appendChild(li);
  }
}

async function cargarPorCliente() {
  const anio = Number($("sel-anio").value);
  const { inicio, fin } = limitesDelAnio(anio);
  const numero = ++pedidoPorCliente;
  aviso("msg-porcliente", "Cargando…");

  const { data, error } = await db.rpc("compras_por_cliente", {
    p_inicio: inicio.toISOString(),
    p_fin: fin.toISOString(),
  });
  if (numero !== pedidoPorCliente) return; // llegó otra petición más nueva

  if (error || !data) {
    aviso("msg-porcliente", "No se pudo cargar la lista. Revisa tu internet e intenta otra vez.", "error");
    return;
  }
  aviso("msg-porcliente", "");
  pintarPorCliente(data, anio);
}

function abrirPorCliente() {
  llenarAnios();
  irA("porcliente");
  cargarPorCliente();
}

$("ir-porcliente").addEventListener("click", abrirPorCliente);
$("sel-anio").addEventListener("change", cargarPorCliente);
