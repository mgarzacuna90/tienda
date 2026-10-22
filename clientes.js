// ===== clientes.js: clientes, saldos, abonos, edición y baja =====

async function cargarClientes() {
  const { data, error } = await db
    .from("saldo_clientes")
    .select("id, nombre, saldo")
    .order("nombre", { ascending: true });

  if (error) {
    aviso("msg-clientes", "No se pudo cargar la lista de clientes. Revisa tu internet e intenta otra vez.", "error");
    return;
  }
  clientes = data.map((c) => ({ ...c, saldo: redondear(c.saldo) }));
  pintarClientes();
  llenarSelectClientes();
  llenarSelectEditar();
}

function pintarClientes() {
  const texto = $("buscar-cliente").value.trim().toLowerCase();
  const visibles = clientes.filter((c) => c.nombre.toLowerCase().includes(texto));
  const lista = $("lista-clientes");
  lista.replaceChildren();

  const porCobrar = clientes.reduce((suma, c) => suma + (c.saldo > 0 ? c.saldo : 0), 0);
  $("total-por-cobrar").textContent = "Total por cobrar: " + dinero.format(porCobrar);

  if (visibles.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "vacio";
    vacio.textContent = clientes.length === 0
      ? "Aún no hay clientes. Toca Nuevo cliente para agregar el primero."
      : "No hay clientes con ese nombre.";
    lista.appendChild(vacio);
    return;
  }

  for (const c of visibles) {
    const li = document.createElement("li");
    li.className = "item";

    const fila = document.createElement("div");
    fila.className = "fila-item";

    const nombre = document.createElement("div");
    nombre.className = "nombre";
    nombre.textContent = c.nombre;

    const saldo = document.createElement("div");
    saldo.className = "saldo " + (c.saldo > 0 ? "debe" : "limpio");
    saldo.textContent = c.saldo > 0 ? "Debe " + dinero.format(c.saldo) : "Sin deuda";

    fila.append(nombre, saldo);
    li.appendChild(fila);

    const acciones = document.createElement("div");
    acciones.className = "acciones-fila";

    const cuenta = document.createElement("button");
    cuenta.type = "button";
    cuenta.textContent = "Cuenta";
    cuenta.addEventListener("click", () => abrirCuenta(c));
    acciones.appendChild(cuenta);

    if (c.saldo > 0) {
      const abonar = document.createElement("button");
      abonar.type = "button";
      abonar.className = "secundario";
      abonar.textContent = abonandoId === c.id ? "Cerrar" : "Abonar";
      abonar.addEventListener("click", () => {
        abonandoId = abonandoId === c.id ? null : c.id;
        aviso("msg-clientes", "");
        pintarClientes();
      });
      acciones.appendChild(abonar);
    }

    li.appendChild(acciones);

    if (abonandoId === c.id && c.saldo > 0) li.appendChild(crearFormularioAbono(c));

    lista.appendChild(li);
  }
}

$("buscar-cliente").addEventListener("input", pintarClientes);

// ---------- Abonos ----------
function crearFormularioAbono(c) {
  const form = document.createElement("form");
  form.className = "subform";

  const campo = crearCampo("¿Cuánto abona? (pesos)", "monto-abono", "number", "");
  campo.input.inputMode = "numeric";
  campo.input.min = "1";
  campo.input.step = "1";
  campo.input.required = true;

  const botones = document.createElement("div");
  botones.className = "fila";

  const guardar = document.createElement("button");
  guardar.type = "submit";
  guardar.textContent = "Guardar abono";

  const cancelar = document.createElement("button");
  cancelar.type = "button";
  cancelar.className = "secundario";
  cancelar.textContent = "Cancelar";
  cancelar.addEventListener("click", () => {
    abonandoId = null;
    pintarClientes();
  });

  botones.append(guardar, cancelar);
  form.append(campo.etiqueta, campo.input, botones);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const monto = redondear(campo.input.value);

    if (!(monto > 0)) {
      aviso("msg-clientes", "Escribe una cantidad mayor a cero.", "error");
      window.scrollTo(0, 0);
      return;
    }
    if (monto > c.saldo) {
      aviso("msg-clientes", c.nombre + " debe " + dinero.format(c.saldo) + ". El abono no puede ser mayor.", "error");
      window.scrollTo(0, 0);
      return;
    }

    guardar.disabled = true;
    const { error } = await db.from("abonos").insert({ cliente_id: c.id, monto });
    guardar.disabled = false;

    if (error) {
      aviso("msg-clientes", "No se pudo guardar el abono. Intenta otra vez.", "error");
      window.scrollTo(0, 0);
      return;
    }

    const nuevoSaldo = c.saldo - monto;
    abonandoId = null;
    await cargarClientes();
    aviso(
      "msg-clientes",
      "Abono guardado ✓ " + (nuevoSaldo > 0
        ? c.nombre + " ahora debe " + dinero.format(nuevoSaldo) + "."
        : c.nombre + " ya no debe nada."),
      "ok"
    );
    window.scrollTo(0, 0);
  });

  setTimeout(() => campo.input.focus(), 0);
  return form;
}

// ---------- Pantalla "Nuevo cliente" ----------
$("ir-nuevo-cliente").addEventListener("click", () => {
  $("form-cliente").reset();
  aviso("msg-nuevo-cliente", "");
  irA("nuevocliente");
});

$("volver-nuevo-cliente").addEventListener("click", () => irA("clientes"));

$("form-cliente").addEventListener("submit", async (e) => {
  e.preventDefault();
  const boton = $("btn-cliente");
  boton.disabled = true;
  aviso("msg-nuevo-cliente", "");

  const { error } = await db.from("clientes").insert({
    nombre: $("cliente-nombre").value.trim(),
  });

  boton.disabled = false;
  if (error) {
    aviso("msg-nuevo-cliente", "No se pudo guardar el cliente. Intenta otra vez.", "error");
    return;
  }

  $("form-cliente").reset();
  irA("clientes");
  await cargarClientes();
  aviso("msg-clientes", "Cliente guardado ✓", "ok");
});

// ---------- Pantalla "Editar cliente" ----------
function clienteElegido() {
  return clientes.find((c) => String(c.id) === $("sel-editar-cliente").value);
}

// Muestra el formulario solo cuando hay un cliente elegido en la lista
function mostrarFormularioEditar(rellenar) {
  const c = clienteElegido();
  $("form-editar-cliente").hidden = !c;
  if (c && rellenar) $("editar-nombre").value = c.nombre;
}

function llenarSelectEditar() {
  const sel = $("sel-editar-cliente");
  const actual = sel.value;
  sel.replaceChildren();

  const base = document.createElement("option");
  base.value = "";
  base.textContent = "Elige un cliente";
  sel.appendChild(base);

  for (const c of clientes) {
    const opcion = document.createElement("option");
    opcion.value = String(c.id);
    opcion.textContent = c.nombre;
    sel.appendChild(opcion);
  }

  sel.value = [...sel.options].some((o) => o.value === actual) ? actual : "";
  mostrarFormularioEditar(false);
}

$("ir-editar-cliente").addEventListener("click", () => {
  $("sel-editar-cliente").value = "";
  mostrarFormularioEditar(false);
  aviso("msg-editar-cliente", "");
  irA("editarcliente");
});

$("volver-editar-cliente").addEventListener("click", () => irA("clientes"));

$("sel-editar-cliente").addEventListener("change", () => {
  aviso("msg-editar-cliente", "");
  mostrarFormularioEditar(true);
});

$("form-editar-cliente").addEventListener("submit", async (e) => {
  e.preventDefault();
  const c = clienteElegido();
  if (!c) return;

  const nuevoNombre = $("editar-nombre").value.trim();
  if (!nuevoNombre) {
    aviso("msg-editar-cliente", "Escribe el nombre del cliente.", "error");
    return;
  }

  const boton = $("btn-editar-cliente");
  boton.disabled = true;
  const { error } = await db.from("clientes").update({ nombre: nuevoNombre }).eq("id", c.id);
  boton.disabled = false;

  if (error) {
    aviso("msg-editar-cliente", "No se pudieron guardar los cambios. Intenta otra vez.", "error");
    return;
  }

  irA("clientes");
  await cargarClientes();
  aviso("msg-clientes", "Cambios guardados ✓", "ok");
});

$("eliminar-cliente").addEventListener("click", async () => {
  const c = clienteElegido();
  if (!c) return;

  if (c.saldo > 0) {
    aviso(
      "msg-editar-cliente",
      c.nombre + " debe " + dinero.format(c.saldo) + ". Registra sus abonos antes de eliminarlo.",
      "error"
    );
    return;
  }
  if (!window.confirm("¿Eliminar a " + c.nombre + "? Sus ventas anteriores se conservan en el historial.")) return;

  const boton = $("eliminar-cliente");
  boton.disabled = true;
  const { error } = await db.from("clientes").delete().eq("id", c.id);
  boton.disabled = false;

  if (error) {
    aviso("msg-editar-cliente", "No se pudo eliminar al cliente. Intenta otra vez.", "error");
    return;
  }

  irA("clientes");
  await cargarClientes();
  aviso("msg-clientes", c.nombre + " eliminado.", "ok");
});
