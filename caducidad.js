// ===== caducidad.js: lotes que están por caducar (solo dueño) =====

const DIAS_AVISO = 7; // un lote entra a la lista cuando faltan 7 días o menos para vencer

// "AAAA-MM-DD" con la fecha local del celular
function textoFecha(f) {
  const mes = String(f.getMonth() + 1).padStart(2, "0");
  const dia = String(f.getDate()).padStart(2, "0");
  return f.getFullYear() + "-" + mes + "-" + dia;
}

// Días que faltan para la fecha (negativo si ya venció)
function diasPara(texto) {
  const [anio, mes, dia] = texto.split("-").map(Number);
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((new Date(anio, mes - 1, dia) - inicioHoy) / 86400000);
}

function textoVence(dias) {
  if (dias < 0) return "Venció hace " + -dias + (dias === -1 ? " día" : " días");
  if (dias === 0) return "Vence hoy";
  if (dias === 1) return "Vence mañana";
  return "Vence en " + dias + " días";
}

// Lotes con piezas que vencen en 7 días o menos (incluye los ya vencidos). Nulo si falla
async function leerPorCaducar() {
  const limite = new Date();
  limite.setDate(limite.getDate() + DIAS_AVISO);
  const { data, error } = await db
    .from("lotes")
    .select("id, caduca, cantidad, productos(nombre)")
    .gt("cantidad", 0)
    .lte("caduca", textoFecha(limite))
    .order("caduca", { ascending: true });
  return error ? null : data;
}

// Contador en el botón de la pantalla Productos
async function actualizarContadorCaducar() {
  if (!esDueno) return;
  const lotes = await leerPorCaducar();
  $("ir-caducar").textContent = lotes && lotes.length > 0 ? "Por caducar (" + lotes.length + ")" : "Por caducar";
}

function pintarCaducar(lotes) {
  const ul = $("lista-caducar");
  ul.replaceChildren();

  if (lotes.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "vacio";
    vacio.textContent = "Nada por caducar en los próximos " + DIAS_AVISO + " días.";
    ul.appendChild(vacio);
    return;
  }

  for (const lote of lotes) {
    const nombreProducto = lote.productos ? lote.productos.nombre : "(producto eliminado)";
    const dias = diasPara(lote.caduca);

    const li = document.createElement("li");
    li.className = "item";

    const fila = document.createElement("div");
    fila.className = "fila-item";
    const izquierda = document.createElement("div");
    const nombre = document.createElement("div");
    nombre.className = "nombre";
    nombre.textContent = nombreProducto;
    const vence = document.createElement("div");
    vence.className = "vence" + (dias < 0 ? " vencido" : "");
    vence.textContent = textoVence(dias);
    izquierda.append(nombre, vence);
    const piezas = document.createElement("strong");
    piezas.textContent = lote.cantidad + (lote.cantidad === 1 ? " pieza" : " piezas");
    fila.append(izquierda, piezas);
    li.appendChild(fila);

    const acciones = document.createElement("div");
    acciones.className = "acciones-fila";
    const retirar = document.createElement("button");
    retirar.type = "button";
    retirar.className = "peligro";
    retirar.textContent = "Retirar";
    retirar.addEventListener("click", async () => {
      if (!window.confirm("¿Retirar " + lote.cantidad + " de " + nombreProducto +
          "? Se descuentan del inventario y no se puede deshacer.")) return;
      retirar.disabled = true;
      const { error } = await db.rpc("retirar_lote", { p_lote_id: lote.id });
      if (error) {
        retirar.disabled = false;
        aviso("msg-caducar", "No se pudo retirar el lote. Intenta otra vez.", "error");
        window.scrollTo(0, 0);
        return;
      }
      await cargarProductos(); // el inventario cambió
      await cargarCaducar();
      aviso("msg-caducar", "Lote retirado ✓ " + nombreProducto + ": se descontaron " + lote.cantidad + ".", "ok");
      window.scrollTo(0, 0);
    });
    acciones.appendChild(retirar);
    li.appendChild(acciones);
    ul.appendChild(li);
  }
}

async function cargarCaducar() {
  const lotes = await leerPorCaducar();
  if (!lotes) {
    $("lista-caducar").replaceChildren();
    aviso("msg-caducar", "No se pudo cargar la lista. Revisa tu internet e intenta otra vez.", "error");
    return;
  }
  pintarCaducar(lotes);
}

$("ir-caducar").addEventListener("click", () => {
  aviso("msg-caducar", "");
  irA("caducar");
  cargarCaducar();
});
