// ===== resumen.js: resumen del Historial (cifras de hoy y ventas por semana, mes o año) =====

let periodoResumen = "semana"; // semana, mes o anio
let pedidoResumen = 0;         // número del último pedido: así se ignoran respuestas viejas

const corto = (fecha) => fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short" });

// Semana (lunes a domingo), mes y año del día elegido
function periodosDe(diaTexto) {
  const [anio, mes, dia] = diaTexto.split("-").map(Number);
  const f = new Date(anio, mes - 1, dia);
  const desdeLunes = (f.getDay() + 6) % 7;

  const mesTexto = f.toLocaleDateString("es-MX", { month: "long", year: "numeric" });

  return [
    {
      titulo: "Semana del " + corto(new Date(anio, mes - 1, dia - desdeLunes)) +
        " al " + corto(new Date(anio, mes - 1, dia - desdeLunes + 6)),
      inicio: new Date(anio, mes - 1, dia - desdeLunes),
      fin: new Date(anio, mes - 1, dia - desdeLunes + 7),
    },
    {
      titulo: "Mes: " + mesTexto.charAt(0).toUpperCase() + mesTexto.slice(1),
      inicio: new Date(anio, mes - 1, 1),
      fin: new Date(anio, mes, 1),
    },
    {
      titulo: "Año " + anio,
      inicio: new Date(anio, 0, 1),
      fin: new Date(anio + 1, 0, 1),
    },
  ];
}

function filaResumen(etiqueta, valor, destacada) {
  const fila = document.createElement("div");
  fila.className = "resumen-fila" + (destacada ? " destacado" : "");
  const izquierda = document.createElement("span");
  izquierda.textContent = etiqueta;
  const derecha = document.createElement("strong");
  derecha.textContent = valor;
  fila.append(izquierda, derecha);
  return fila;
}

// Cuentas por cobrar: lo que deben hoy todos los clientes (null si falla la consulta)
async function leerPorCobrar() {
  const { data, error } = await db.from("saldo_clientes").select("saldo");
  if (error || !data) return null;
  return data.reduce((suma, c) => {
    const saldo = redondear(c.saldo);
    return suma + (saldo > 0 ? saldo : 0);
  }, 0);
}

// Dinero en cuenta y en efectivo, escrito a mano por el dueño (tabla ajustes). Devuelve null si falla
async function leerDinero() {
  const { data, error } = await db
    .from("ajustes")
    .select("dinero_cuenta, dinero_efectivo")
    .eq("id", 1)
    .maybeSingle();
  if (error) return null;
  if (!data) return { cuenta: 0, efectivo: 0 };
  return {
    cuenta: Number(data.dinero_cuenta) || 0,
    efectivo: Number(data.dinero_efectivo) || 0,
  };
}

// Dinero invertido: suma de las recompras pagadas desde la fecha de inicio (la calcula la base)
async function leerInvertido() {
  const { data, error } = await db.rpc("invertido_total");
  if (error) return null;
  return Number(data) || 0;
}

// Fecha desde la que se cuenta el dinero invertido (null si falla)
async function leerDesde() {
  const { data, error } = await db.from("ajustes").select("invertido_desde").eq("id", 1).maybeSingle();
  if (error || !data) return null;
  return data.invertido_desde;
}

function mensajeVacio(texto) {
  const p = document.createElement("p");
  p.className = "vacio";
  p.textContent = texto;
  return p;
}

async function cargarResumenes(diaTexto) {
  const dia = diaTexto || $("fecha-historial").value || hoyTexto();
  const periodo = periodosDe(dia)[["semana", "mes", "anio"].indexOf(periodoResumen)];
  const numero = ++pedidoResumen;

  // Una consulta por cada dato; las funciones de Supabase suman las ventas y abonos del periodo
  const [res, porCobrar, dineroMano, invertido] = await Promise.all([
    db.rpc("resumen_periodo", { p_inicio: periodo.inicio.toISOString(), p_fin: periodo.fin.toISOString() }),
    leerPorCobrar(),
    esDueno ? leerDinero() : Promise.resolve(undefined),
    esDueno ? leerInvertido() : Promise.resolve(undefined),
  ]);
  if (numero !== pedidoResumen) return; // llegó otra petición más nueva

  // ----- Cifras de hoy -----
  const ahora = $("resumen-dinero");
  ahora.replaceChildren();
  ahora.appendChild(filaResumen("Cuentas por cobrar", porCobrar === null ? "—" : dinero.format(porCobrar)));
  if (esDueno) {
    ahora.appendChild(filaResumen("Dinero invertido", invertido === null ? "—" : dinero.format(redondear(invertido))));
    if (dineroMano) {
      ahora.append(
        filaResumen("Dinero en cuenta", dinero.format(redondear(dineroMano.cuenta))),
        filaResumen("Dinero en efectivo", dinero.format(redondear(dineroMano.efectivo)))
      );
    } else {
      ahora.appendChild(mensajeVacio("No se pudo cargar el dinero."));
    }
  }

  // ----- Ventas del periodo elegido -----
  const bloque = $("resumen-periodo");
  bloque.replaceChildren();
  const titulo = document.createElement("h3");
  titulo.textContent = periodo.titulo;
  bloque.appendChild(titulo);

  if (res.error || !res.data || !res.data[0]) {
    bloque.appendChild(mensajeVacio("No se pudo cargar este resumen."));
    return;
  }
  const d = res.data[0];
  const contado = Number(d.contado);
  const abonos = Number(d.abonos);
  bloque.append(
    filaResumen("Ventas (" + Number(d.num_ventas) + ")", dinero.format(redondear(d.total))),
    filaResumen("De contado", dinero.format(redondear(contado))),
    filaResumen("A crédito", dinero.format(redondear(d.credito))),
    filaResumen("Abonos recibidos", dinero.format(redondear(abonos))),
    filaResumen("Dinero recibido", dinero.format(redondear(contado + abonos)), true)
  );
}

// ---------- Filtro: semana, mes o año ----------
$("filtro-resumen").addEventListener("click", (e) => {
  const boton = e.target.closest("button[data-periodo]");
  if (!boton) return;
  periodoResumen = boton.dataset.periodo;
  for (const b of $("filtro-resumen").querySelectorAll("button")) {
    const activo = b === boton;
    b.classList.toggle("secundario", !activo);
    b.setAttribute("aria-pressed", String(activo));
  }
  cargarResumenes();
});
