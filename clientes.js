// ===== clientes.js: pantalla de Clientes, saldos y abonos =====

async function cargarClientes() {
  const { data, error } = await db
    .from("saldo_clientes")
    .select("id, nombre, telefono, saldo")
    .order("nombre", { ascending: true });

  if (error) {
    aviso("msg-clientes", "No se pudo cargar la lista de clientes. Revisa tu internet e intenta otra vez.", "error");
    return;
  }
  clientes = data.map((c) => ({ ...c, saldo: redondear(c.saldo) }));
  pintarClientes();
  llenarSelectClientes();
}

function pintarClientes() {
  const texto = $("buscar-cliente").value.trim().toLowerCase();
  const visibles = clientes.filter((c) => c.nombre.toLowerCase().includes(texto));
  const lista = $("lista-clientes");
  lista.replaceChildren();

  const porCobrar = redondear(clientes.reduce((suma, c) => suma + (c.saldo > 0 ? c.saldo : 0), 0));
  $("total-por-cobrar").textContent = "Total por cobrar: " + dinero.format(porCobrar);

  if (visibles.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "vacio";
    vacio.textContent = clientes.length === 0
      ? "Aún no hay clientes. Agrega el primero arriba."
      : "No hay clientes con ese nombre.";
    lista.appendChild(vacio);
    return;
  }

  for (const c of visibles) {
    const li = document.createElement("li");
    li.className = "item";

    const fila = document.createElement("div");
    fila.className = "fila-item";

    const izquierda = document.createElement("div");
    const nombre = document.createElement("div");
    nombre.className = "nombre";
    nombre.textContent = c.nombre;
    const detalle = document.createElement("div");
    detalle.className = "detalle";
    detalle.textContent = c.telefono || "Sin teléfono";
    izquierda.append(nombre, detalle);

    const derecha = document.createElement("div");
    derecha.className = "derecha-item";
    const saldo = document.createElement("div");
    saldo.className = "saldo " + (c.saldo > 0 ? "debe" : "limpio");
    saldo.textContent = c.saldo > 0 ? "Debe " + dinero.format(c.saldo) : "Sin deuda";
    derecha.appendChild(saldo);

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
      derecha.appendChild(abonar);
    }

    fila.append(izquierda, derecha);
    li.appendChild(fila);

    if (abonandoId === c.id && c.saldo > 0) {
      li.appendChild(crearFormularioAbono(c));
    }

    lista.appendChild(li);
  }
}

function crearFormularioAbono(c) {
  const form = document.createElement("form");
  form.className = "subform";

  const campo = crearCampo("¿Cuánto abona?", "monto-abono", "number", "");
  campo.input.inputMode = "decimal";
  campo.input.min = "0";
  campo.input.step = "any";
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

    const nuevoSaldo = redondear(c.saldo - monto);
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

$("buscar-cliente").addEventListener("input", pintarClientes);

// ---------- Agregar un cliente nuevo ----------
$("form-cliente").addEventListener("submit", async (e) => {
  e.preventDefault();
  const boton = $("btn-cliente");
  boton.disabled = true;
  aviso("msg-clientes", "");

  const telefono = $("cliente-telefono").value.trim();
  const { error } = await db.from("clientes").insert({
    nombre: $("cliente-nombre").value.trim(),
    telefono: telefono || null,
  });

  boton.disabled = false;
  if (error) {
    aviso("msg-clientes", "No se pudo guardar el cliente. Intenta otra vez.", "error");
    return;
  }

  $("form-cliente").reset();
  await cargarClientes();
  aviso("msg-clientes", "Cliente guardado ✓", "ok");
});
