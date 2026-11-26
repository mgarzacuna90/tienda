// ===== configuracion.js: pantalla de Configuración (solo dueño) y dinero a mano =====

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
  for (const id of ["dinero-cuenta", "dinero-efectivo", "dinero-invertido"]) $(id).value = "";
  irA("configuracion");

  const guardado = await leerDinero();
  if (!guardado) {
    aviso("msg-config", "No se pudo cargar el dinero. Revisa tu internet e intenta otra vez.", "error");
    return;
  }
  $("dinero-cuenta").value = guardado.cuenta;
  $("dinero-efectivo").value = guardado.efectivo;
  $("dinero-invertido").value = guardado.invertido;
  $("btn-guardar-dinero").disabled = false;
}

$("ir-configuracion").addEventListener("click", abrirConfiguracion);

$("form-dinero").addEventListener("submit", async (e) => {
  e.preventDefault();
  const cuenta = pesosDeTexto($("dinero-cuenta").value);
  const efectivo = pesosDeTexto($("dinero-efectivo").value);
  const invertido = pesosDeTexto($("dinero-invertido").value);
  if (cuenta === null || efectivo === null || invertido === null) {
    aviso("msg-config", "Escribe solo números, sin letras ni signos.", "error");
    return;
  }

  const boton = $("btn-guardar-dinero");
  boton.disabled = true;
  const { error } = await db
    .from("ajustes")
    .upsert({ id: 1, dinero_cuenta: cuenta, dinero_efectivo: efectivo, dinero_invertido: invertido });
  boton.disabled = false;

  if (error) {
    aviso("msg-config", "No se pudo guardar el dinero. Intenta otra vez.", "error");
    return;
  }
  $("dinero-cuenta").value = cuenta;
  $("dinero-efectivo").value = efectivo;
  $("dinero-invertido").value = invertido;
  aviso("msg-config", "Dinero guardado ✓", "ok");
  cargarResumenes(); // el resumen del Historial ya queda al día
});
