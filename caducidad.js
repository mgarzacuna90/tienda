// ===== caducidad.js: productos por caducar (solo dueño) =====

const DIAS_AVISO = 7; // un producto entra a la lista cuando faltan 7 días o menos para vencer

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

// Productos con existencia cuya fecha vence en 7 días o menos (incluye los ya vencidos). Nulo si falla
async function leerPorCaducar() {
  const limite = new Date();
  limite.setDate(limite.getDate() + DIAS_AVISO);
  const { data, error } = await db
    .from("productos")
    .select("id, nombre, cantidad, caduca")
    .gt("cantidad", 0)
    .lte("caduca", textoFecha(limite))
    .order("caduca", { ascending: true });
  return error ? null : data;
}

// Contador en el botón de la pantalla Productos
async function actualizarContadorCaducar() {
  if (!esDueno) return;
  const lista = await leerPorCaducar();
  $("ir-caducar").textContent = lista && lista.length > 0 ? "Por caducar (" + lista.length + ")" : "Por caducar";
}

function pintarCaducar(lista) {
  const ul = $("lista-caducar");
  ul.replaceChildren();

  if (lista.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "vacio";
    vacio.textContent = "Nada por caducar en los próximos " + DIAS_AVISO + " días.";
    ul.appendChild(vacio);
    return;
  }

  for (const p of lista) {
    const dias = diasPara(p.caduca);

    const li = document.createElement("li");
    li.className = "item";

    const fila = document.createElement("div");
    fila.className = "fila-item";
    const izquierda = document.createElement("div");
    const nombre = document.createElement("div");
    nombre.className = "nombre";
    nombre.textContent = p.nombre;
    const vence = document.createElement("div");
    vence.className = "vence" + (dias < 0 ? " vencido" : "");
    vence.textContent = textoVence(dias);
    izquierda.append(nombre, vence);
    const piezas = document.createElement("strong");
    piezas.textContent = p.cantidad + (p.cantidad === 1 ? " pieza" : " piezas");
    fila.append(izquierda, piezas);
    li.appendChild(fila);

    const acciones = document.createElement("div");
    acciones.className = "acciones-fila";
    const retirar = document.createElement("button");
    retirar.type = "button";
    retirar.className = "peligro";
    retirar.textContent = "Retirar";
    retirar.addEventListener("click", async () => {
      const texto = window.prompt("¿Cuántas piezas de " + p.nombre + " retiras? (máximo " + p.cantidad + ")", String(p.cantidad));
      if (texto === null) return;
      const cantidad = parseInt(texto, 10);
      if (!(cantidad > 0) || cantidad > p.cantidad) {
        aviso("msg-caducar", "Escribe un número entre 1 y " + p.cantidad + ".", "error");
        window.scrollTo(0, 0);
        return;
      }
      if (!window.confirm("Se descontarán " + cantidad + " de " + p.nombre + " del inventario y se borrará su fecha de caducidad" +
          (cantidad < p.cantidad ? " (las que quedan se quedan sin fecha: anótala en Editar producto)" : "") + ". No se puede deshacer. ¿Continuar?")) return;

      retirar.disabled = true;
      const { error } = await db.rpc("retirar_vencidos", { p_producto_id: p.id, p_cantidad: cantidad });
      if (error) {
        retirar.disabled = false;
        aviso("msg-caducar", "No se pudo retirar. Intenta otra vez.", "error");
        window.scrollTo(0, 0);
        return;
      }
      await cargarProductos(); // el inventario cambió
      await cargarCaducar();
      aviso("msg-caducar", "Retirado ✓ " + p.nombre + ": se descontaron " + cantidad + ".", "ok");
      window.scrollTo(0, 0);
    });
    acciones.appendChild(retirar);
    li.appendChild(acciones);
    ul.appendChild(li);
  }
}

async function cargarCaducar() {
  const lista = await leerPorCaducar();
  if (!lista) {
    $("lista-caducar").replaceChildren();
    aviso("msg-caducar", "No se pudo cargar la lista. Revisa tu internet e intenta otra vez.", "error");
    return;
  }
  pintarCaducar(lista);
}

$("ir-caducar").addEventListener("click", () => {
  aviso("msg-caducar", "");
  irA("caducar");
  cargarCaducar();
});
