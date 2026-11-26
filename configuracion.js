// ===== configuracion.js: pantalla de Configuración (solo dueño): dinero en cuenta y en efectivo =====

// Convierte lo escrito en pesos enteros. Vacío = 0. Devuelve null si no es un número válido
function pesosDeTexto(texto) {
  const limpio = texto.replace(/[\s$,]/g, "");
  if (limpio === "") return 0;
  const n = Number(limpio);
  if (!Number.isFinite(n) || n < 0) return null;
  return redondear(n);
}

async function abrirConfiguracion() {
  aviso("msg-config", "");
  // Mientras no se carguen las cifras guardadas no se puede guardar (así no se borran por error)
  $("btn-guardar-dinero").disabled = true;
  for (const id of ["dinero-cuenta", "dinero-efectivo"]) $(id).value = "";
  $("invertido-nota").textContent = "";
  irA("configuracion");

  const [guardado, desde] = await Promise.all([leerDinero(), leerDesde()]);
  if (!guardado) {
    aviso("msg-config", "No se pudo cargar el dinero. Revisa tu internet e intenta otra vez.", "error");
    return;
  }
  $("dinero-cuenta").value = guardado.cuenta;
  $("dinero-efectivo").value = guardado.efectivo;
  $("invertido-nota").textContent = desde
    ? "El dinero invertido se calcula solo: suma lo que costaron las recompras pagadas desde el " +
      new Date(desde).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) + "."
    : "El dinero invertido se calcula solo, con las recompras pagadas.";
  $("btn-guardar-dinero").disabled = false;
}

$("ir-configuracion").addEventListener("click", abrirConfiguracion);

$("form-dinero").addEventListener("submit", async (e) => {
  e.preventDefault();
  const cuenta = pesosDeTexto($("dinero-cuenta").value);
  const efectivo = pesosDeTexto($("dinero-efectivo").value);
  if (cuenta === null || efectivo === null) {
    aviso("msg-config", "Escribe solo números, sin letras ni signos.", "error");
    return;
  }

  const boton = $("btn-guardar-dinero");
  boton.disabled = true;
  const { error } = await db
    .from("ajustes")
    .upsert({ id: 1, dinero_cuenta: cuenta, dinero_efectivo: efectivo });
  boton.disabled = false;

  if (error) {
    aviso("msg-config", "No se pudo guardar el dinero. Intenta otra vez.", "error");
    return;
  }
  $("dinero-cuenta").value = cuenta;
  $("dinero-efectivo").value = efectivo;
  aviso("msg-config", "Dinero guardado ✓", "ok");
  cargarResumenes(); // el resumen del Historial ya queda al día
});
