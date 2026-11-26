// ===== gastos.js: tabla de gastos (todas las recompras de mercancía; solo dueño) =====

const LIMITE_GASTOS = 200; // la API devuelve máximo 1000 filas: se muestran las más recientes

// Día y mes arriba, año abajo (así la columna queda angosta en el celular)
function celdaFecha(texto) {
  const f = new Date(texto);
  const td = document.createElement("td");
  td.textContent = f.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  const anio = document.createElement("div");
  anio.className = "detalle";
  anio.textContent = String(f.getFullYear());
  td.appendChild(anio);
  return td;
}

function celda(tipo, texto, clase) {
  const td = document.createElement(tipo);
  td.textContent = texto;
  if (clase) td.className = clase;
  return td;
}

function pintarGastos(compras) {
  const total = compras.reduce((suma, c) => suma + Number(c.costo), 0);
  $("gastos-total").textContent =
    (compras.length >= LIMITE_GASTOS ? "Total de las últimas " + LIMITE_GASTOS + " compras: " : "Total gastado: ") +
    dinero.format(redondear(total));

  const contenedor = $("gastos-tabla");
  contenedor.replaceChildren();

  if (compras.length === 0) {
    const vacio = document.createElement("p");
    vacio.className = "vacio";
    vacio.textContent = "Aún no hay recompras registradas.";
    contenedor.appendChild(vacio);
    return;
  }

  const tabla = document.createElement("table");
  tabla.className = "tabla-gastos";
  const encabezado = document.createElement("tr");
  encabezado.append(
    celda("th", "Fecha"),
    celda("th", "Cant.", "num"),
    celda("th", "Producto"),
    celda("th", "Costo", "num")
  );
  const cabeza = document.createElement("thead");
  cabeza.appendChild(encabezado);
  tabla.appendChild(cabeza);

  const cuerpo = document.createElement("tbody");
  for (const c of compras) {
    const items = c.compra_items && c.compra_items.length > 0 ? c.compra_items : [null];
    items.forEach((it, i) => {
      const fila = document.createElement("tr");
      if (i === 0) fila.className = "inicio-compra";

      if (i === 0) {
        const fecha = celdaFecha(c.created_at);
        fecha.rowSpan = items.length;
        fila.appendChild(fecha);
      }
      fila.append(
        celda("td", it ? String(it.cantidad) : "", "num"),
        celda("td", it ? it.nombre : "(sin productos)")
      );
      if (i === 0) {
        const costo = celda("td", dinero.format(redondear(c.costo)), "num");
        costo.rowSpan = items.length;
        if (!c.pagada) {
          const sinPagar = document.createElement("div");
          sinPagar.className = "sin-pagar";
          sinPagar.textContent = "Sin pagar";
          costo.appendChild(sinPagar);
        }
        fila.appendChild(costo);
      }
      cuerpo.appendChild(fila);
    });
  }
  tabla.appendChild(cuerpo);
  contenedor.appendChild(tabla);
}

async function abrirGastos() {
  $("gastos-total").textContent = "";
  $("gastos-tabla").replaceChildren();
  aviso("msg-gastos", "Cargando…");
  irA("gastos");

  const { data, error } = await db
    .from("compras")
    .select("id, created_at, costo, pagada, compra_items(nombre, cantidad)")
    .order("created_at", { ascending: false })
    .limit(LIMITE_GASTOS);

  if (error) {
    aviso("msg-gastos", "No se pudieron cargar los gastos. Revisa tu internet e intenta otra vez.", "error");
    return;
  }
  aviso("msg-gastos", "");
  pintarGastos(data);
}

$("ir-gastos").addEventListener("click", abrirGastos);
