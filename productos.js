// ===== productos.js: lista de productos, fotos, edición y alta =====

const BUCKET = "productos"; // carpeta de fotos en Supabase

// ---------- Fotos ----------
// De la dirección de la foto sacamos su nombre de archivo (para poder borrarla)
function rutaDeFoto(url) {
  if (!url) return null;
  const marca = "/" + BUCKET + "/";
  const i = url.indexOf(marca);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marca.length).split("?")[0]);
}

// Recorta la foto a un cuadrado chico para que la app cargue rápido
function reducirFoto(archivo) {
  return new Promise((resolve, reject) => {
    const direccion = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const lado = 320;
      const canvas = document.createElement("canvas");
      canvas.width = lado;
      canvas.height = lado;
      const recorte = Math.min(img.width, img.height);
      const x = (img.width - recorte) / 2;
      const y = (img.height - recorte) / 2;
      canvas.getContext("2d").drawImage(img, x, y, recorte, recorte, 0, 0, lado, lado);
      URL.revokeObjectURL(direccion);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo preparar la foto"))),
        "image/jpeg",
        0.8
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(direccion);
      reject(new Error("No se pudo leer la foto"));
    };
    img.src = direccion;
  });
}

async function subirFoto(archivo) {
  const blob = await reducirFoto(archivo);
  const ruta = Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".jpg";
  const { error } = await db.storage.from(BUCKET).upload(ruta, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return db.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
}

async function borrarFoto(url) {
  const ruta = rutaDeFoto(url);
  if (ruta) await db.storage.from(BUCKET).remove([ruta]);
}

// Cuadrito con la foto del producto (o su inicial si no tiene foto)
function crearMiniatura(p, clase) {
  const caja = document.createElement("div");
  caja.className = clase;
  if (p.imagen_url) {
    const img = document.createElement("img");
    img.src = p.imagen_url;
    img.alt = "";
    img.loading = "lazy";
    caja.appendChild(img);
  } else {
    caja.textContent = (p.nombre.trim()[0] || "?").toUpperCase();
  }
  return caja;
}

// ¿Hay que comprar este producto? (menos del mínimo, o ya sin inventario)
const estaBajo = (p) => p.cantidad < p.minimo || p.cantidad <= 0;

// ---------- Leer productos ----------
// Lotes con piezas de cada producto (solo el dueño los lee): { idProducto: [{ id, caduca, cantidad }, ...] }, del que vence primero al último
let lotesPorProducto = {};

async function cargarLotes() {
  lotesPorProducto = {};
  if (!esDueno) return;
  const { data, error } = await db
    .from("lotes")
    .select("id, producto_id, caduca, cantidad")
    .gt("cantidad", 0)
    .order("caduca", { ascending: true });
  if (error || !data) return; // si falla, la app sigue funcionando sin la información de lotes
  for (const l of data) (lotesPorProducto[l.producto_id] = lotesPorProducto[l.producto_id] || []).push(l);
}

// Piezas de un producto que tienen fecha de caducidad (suma de sus lotes)
function piezasConFecha(idProducto) {
  return (lotesPorProducto[idProducto] || []).reduce((suma, l) => suma + l.cantidad, 0);
}

async function cargarProductos() {
  const { data, error } = await db
    .from("productos")
    .select("id, nombre, precio, cantidad, minimo, posicion, imagen_url")
    .order("nombre", { ascending: true });

  if (error) {
    aviso("msg-lista", "No se pudo cargar la lista. Revisa tu internet e intenta otra vez.", "error");
    return;
  }
  aviso("msg-lista", "");
  productos = data;
  await cargarLotes();

  // Si un producto ya no existe, lo quitamos de la venta en curso.
  for (const id of Object.keys(carrito)) {
    if (!productos.some((x) => String(x.id) === id)) delete carrito[id];
  }

  pintarLista();
  pintarVender();
  pintarCarrito();
  pintarComprar();
  actualizarCobro();
  actualizarContadorCaducar();
}

// ---------- Lista de la pantalla "Productos" ----------
function pintarLista() {
  const lista = $("lista");
  lista.replaceChildren();

  if (productos.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "vacio";
    vacio.textContent = "Aún no hay productos. Toca Nuevo producto para agregar el primero.";
    lista.appendChild(vacio);
    return;
  }

  for (const p of productos) {
    const li = document.createElement("li");
    li.className = "item";

    const fila = document.createElement("div");
    fila.className = "fila-item";

    const izquierda = document.createElement("div");
    izquierda.className = "con-foto";
    const textos = document.createElement("div");
    const nombre = document.createElement("div");
    nombre.className = "nombre";
    nombre.textContent = p.nombre;
    const detalle = document.createElement("div");
    detalle.className = "detalle" + (estaBajo(p) ? " inv-bajo" : "");
    detalle.textContent =
      "Inventario: " + p.cantidad +
      (p.minimo > 0 ? " · Mínimo: " + p.minimo : "") +
      (p.posicion ? " · Lugar " + p.posicion : "");
    textos.append(nombre, detalle);
    izquierda.append(crearMiniatura(p, "foto-chica"), textos);

    const derecha = document.createElement("div");
    derecha.className = "derecha-item";
    const precio = document.createElement("div");
    precio.className = "precio";
    precio.textContent = dinero.format(p.precio);
    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "secundario";
    editar.textContent = editandoId === p.id ? "Cerrar" : "Editar";
    editar.addEventListener("click", () => {
      editandoId = editandoId === p.id ? null : p.id;
      aviso("msg-editar", "");
      pintarLista();
    });
    derecha.append(precio, editar);

    fila.append(izquierda, derecha);
    li.appendChild(fila);

    if (editandoId === p.id) {
      li.appendChild(crearFormularioProducto(p));
    }

    lista.appendChild(li);
  }
}

// ---------- Editar o eliminar un producto ----------
function crearFormularioProducto(p) {
  const form = document.createElement("form");
  form.className = "subform";

  const vistaPrevia = crearMiniatura(p, "foto-chica");
  vistaPrevia.style.marginBottom = "0.75rem";

  const foto = crearCampo("Cambiar foto (opcional)", "edit-foto", "file", "");
  foto.input.accept = "image/*";

  let quitarFoto = false;
  let quitar = null;
  if (p.imagen_url) {
    quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "secundario";
    quitar.textContent = "Quitar foto actual";
    quitar.style.marginBottom = "0.9rem";
    quitar.addEventListener("click", () => {
      quitarFoto = true;
      quitar.disabled = true;
      quitar.textContent = "Se quitará al guardar ✓";
    });
  }

  const nombre = crearCampo("Nombre", "edit-nombre", "text", p.nombre);
  nombre.input.required = true;
  nombre.input.autocomplete = "off";

  const precio = crearCampo("Precio (pesos)", "edit-precio", "number", p.precio);
  precio.input.inputMode = "numeric";
  precio.input.min = "0";
  precio.input.step = "1";
  precio.input.required = true;

  const inventario = crearCampo("Cantidad en inventario", "edit-cantidad", "number", p.cantidad);
  inventario.input.step = "1";
  inventario.input.required = true;

  const llegaron = crearCampo("¿Llegó mercancía? Escribe cuántas piezas llegaron (opcional)", "edit-llegaron", "number", "");
  llegaron.input.inputMode = "numeric";
  llegaron.input.min = "0";
  llegaron.input.step = "1";

  // Caducidad por lotes: cada compra con fecha forma un lote; al vender se descuenta primero del que vence antes
  const conFecha = piezasConFecha(p.id);
  const sinFecha = Math.max(p.cantidad - conFecha, 0);
  const notaInventario = document.createElement("p");
  notaInventario.className = "detalle";
  notaInventario.style.marginTop = "-0.5rem";
  notaInventario.textContent =
    "Con fecha de caducidad: " + conFecha + " · Sin fecha: " + sinFecha +
    ". Si bajas el inventario, se descuenta primero de los lotes que vencen antes.";

  let fechaSinFecha = null;
  let etiquetaSinFecha = null;
  if (sinFecha > 0) {
    etiquetaSinFecha = document.createElement("label");
    etiquetaSinFecha.htmlFor = "edit-fecha-sinfecha";
    etiquetaSinFecha.textContent =
      "Fecha de caducidad de " + (sinFecha === 1 ? "la pieza sin fecha" : "las " + sinFecha + " piezas sin fecha") + " (opcional)";
    fechaSinFecha = document.createElement("input");
    fechaSinFecha.type = "date";
    fechaSinFecha.id = "edit-fecha-sinfecha";
  }

  const etiquetaFechaLlegaron = document.createElement("label");
  etiquetaFechaLlegaron.htmlFor = "edit-fecha-llegaron";
  etiquetaFechaLlegaron.textContent = "Fecha de caducidad de lo que llegó";
  const fechaLlegaron = document.createElement("input");
  fechaLlegaron.type = "date";
  fechaLlegaron.id = "edit-fecha-llegaron";
  const bloqueLlegaron = document.createElement("div");
  bloqueLlegaron.hidden = true;
  bloqueLlegaron.append(etiquetaFechaLlegaron, fechaLlegaron);
  llegaron.input.addEventListener("input", () => {
    bloqueLlegaron.hidden = !((parseInt(llegaron.input.value, 10) || 0) > 0);
  });

  const minimo = crearCampo("Inventario mínimo (avisa cuando haya menos)", "edit-minimo", "number", p.minimo);
  minimo.input.inputMode = "numeric";
  minimo.input.min = "0";
  minimo.input.step = "1";

  // Lugar en la pantalla de Vender: los 9 primeros cuadritos
  const etiquetaLugar = document.createElement("label");
  etiquetaLugar.htmlFor = "edit-lugar";
  etiquetaLugar.textContent = "Lugar en Vender (los 9 primeros)";
  const lugar = document.createElement("select");
  lugar.id = "edit-lugar";
  lugar.appendChild(new Option("Sin lugar fijo (orden alfabético)", ""));
  for (let n = 1; n <= 9; n++) {
    const ocupante = productos.find((x) => x.posicion === n && x.id !== p.id);
    lugar.appendChild(
      new Option("Lugar " + n + (ocupante ? " · hoy: " + ocupante.nombre : " · libre"), String(n))
    );
  }
  lugar.value = p.posicion ? String(p.posicion) : "";

  const botones = document.createElement("div");
  botones.className = "fila";

  const guardar = document.createElement("button");
  guardar.type = "submit";
  guardar.textContent = "Guardar cambios";

  const cancelar = document.createElement("button");
  cancelar.type = "button";
  cancelar.className = "secundario";
  cancelar.textContent = "Cancelar";
  cancelar.addEventListener("click", () => {
    editandoId = null;
    pintarLista();
  });
  botones.append(guardar, cancelar);

  const eliminar = document.createElement("button");
  eliminar.type = "button";
  eliminar.className = "peligro grande";
  eliminar.textContent = "Eliminar producto";

  form.append(
    ...[
      vistaPrevia, foto.etiqueta, foto.input, quitar,
      nombre.etiqueta, nombre.input,
      precio.etiqueta, precio.input,
      inventario.etiqueta, inventario.input, notaInventario,
      etiquetaSinFecha, fechaSinFecha,
      llegaron.etiqueta, llegaron.input, bloqueLlegaron,
      minimo.etiqueta, minimo.input,
      etiquetaLugar, lugar,
      botones, eliminar,
    ].filter(Boolean)
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nuevoNombre = nombre.input.value.trim();
    const nuevoPrecio = redondear(precio.input.value);
    const nuevoInventario = parseInt(inventario.input.value, 10);
    const llegan = parseInt(llegaron.input.value, 10) || 0;
    const nuevoMinimo = parseInt(minimo.input.value, 10) || 0;

    if (!nuevoNombre || !(nuevoPrecio >= 0) || !Number.isFinite(nuevoInventario) || nuevoMinimo < 0) {
      aviso("msg-editar", "Revisa los datos: el nombre, el precio y la cantidad deben estar completos.", "error");
      window.scrollTo(0, 0);
      return;
    }
    if (llegan > 0 && !fechaLlegaron.value) {
      aviso("msg-editar", "Escribe la fecha de caducidad de lo que llegó.", "error");
      window.scrollTo(0, 0);
      return;
    }

    guardar.disabled = true;
    aviso("msg-editar", "Guardando…");

    let nuevaFoto = p.imagen_url;
    try {
      const archivo = foto.input.files[0];
      if (archivo) nuevaFoto = await subirFoto(archivo);
      else if (quitarFoto) nuevaFoto = null;
    } catch (err) {
      guardar.disabled = false;
      aviso("msg-editar", "No se pudo subir la foto. Revisa tu internet e intenta otra vez.", "error");
      window.scrollTo(0, 0);
      return;
    }

    // La cantidad no se guarda aquí: la cambian las funciones de abajo, que cuidan los lotes
    const { error } = await db
      .from("productos")
      .update({ nombre: nuevoNombre, precio: nuevoPrecio, minimo: nuevoMinimo, imagen_url: nuevaFoto })
      .eq("id", p.id);
    guardar.disabled = false;

    if (error) {
      aviso("msg-editar", "No se pudieron guardar los cambios. Intenta otra vez.", "error");
      window.scrollTo(0, 0);
      return;
    }

    if (p.imagen_url && nuevaFoto !== p.imagen_url) borrarFoto(p.imagen_url).catch(() => {});

    // Si cambió el lugar en Vender, esta función de Supabase acomoda también al producto que lo tenía.
    const nuevoLugar = lugar.value ? parseInt(lugar.value, 10) : null;
    let falloLugar = false;
    if (nuevoLugar !== (p.posicion || null)) {
      const { error: errorLugar } = await db.rpc("asignar_lugar", { p_producto_id: p.id, p_lugar: nuevoLugar });
      falloLugar = Boolean(errorLugar);
    }

    // Inventario y lotes, en este orden: 1) el inventario escrito (si bajó, se descuenta de los lotes que vencen antes),
    // 2) la fecha de las piezas sin fecha, 3) lo que llegó, que forma un lote nuevo
    let falloLotes = false;
    if (nuevoInventario !== p.cantidad) {
      const { error: e1 } = await db.rpc("fijar_inventario", { p_producto_id: p.id, p_cantidad: nuevoInventario });
      falloLotes = Boolean(e1);
    }
    if (!falloLotes && fechaSinFecha && fechaSinFecha.value) {
      const { error: e2 } = await db.rpc("agregar_lote", { p_producto_id: p.id, p_caduca: fechaSinFecha.value });
      falloLotes = Boolean(e2);
    }
    if (!falloLotes && llegan > 0) {
      const { error: e3 } = await db.rpc("agregar_lote", {
        p_producto_id: p.id, p_caduca: fechaLlegaron.value, p_cantidad: llegan, p_sumar: true,
      });
      falloLotes = Boolean(e3);
    }

    editandoId = null;
    await cargarProductos();
    const actual = productos.find((x) => x.id === p.id);
    if (falloLotes) {
      aviso("msg-editar", "Se guardaron los datos del producto, pero no el inventario o la fecha de caducidad. Abre el producto y revisa.", "error");
    } else if (falloLugar) {
      aviso("msg-editar", "Se guardaron los cambios, pero no se pudo cambiar el lugar en Vender. Intenta otra vez.", "error");
    } else {
      aviso(
        "msg-editar",
        "Cambios guardados ✓ " + nuevoNombre + ": " + dinero.format(nuevoPrecio) + ", inventario " + (actual ? actual.cantidad : nuevoInventario) + ".",
        "ok"
      );
    }
    window.scrollTo(0, 0);
  });

  eliminar.addEventListener("click", async () => {
    if (!window.confirm("¿Eliminar " + p.nombre + "? Las ventas anteriores se conservan.")) return;

    eliminar.disabled = true;
    const { error } = await db.from("productos").delete().eq("id", p.id);
    eliminar.disabled = false;

    if (error) {
      aviso("msg-editar", "No se pudo eliminar el producto. Intenta otra vez.", "error");
      window.scrollTo(0, 0);
      return;
    }

    if (p.imagen_url) borrarFoto(p.imagen_url).catch(() => {});

    editandoId = null;
    await cargarProductos();
    aviso("msg-editar", p.nombre + " eliminado.", "ok");
    window.scrollTo(0, 0);
  });

  return form;
}

// ---------- Agregar un producto nuevo ----------
$("form-agregar").addEventListener("submit", async (e) => {
  e.preventDefault();
  const boton = $("btn-guardar");
  boton.disabled = true;
  aviso("msg-agregar", "Guardando…");

  let imagenUrl = null;
  try {
    const archivo = $("foto").files[0];
    if (archivo) imagenUrl = await subirFoto(archivo);
  } catch (err) {
    boton.disabled = false;
    aviso("msg-agregar", "No se pudo subir la foto. Revisa tu internet e intenta otra vez.", "error");
    return;
  }

  const { error } = await db.from("productos").insert({
    nombre: $("nombre").value.trim(),
    precio: redondear($("precio").value),
    cantidad: parseInt($("cantidad").value, 10),
    minimo: parseInt($("minimo").value, 10) || 0,
    imagen_url: imagenUrl,
  });

  boton.disabled = false;
  if (error) {
    aviso("msg-agregar", "No se pudo guardar el producto. Intenta otra vez.", "error");
    return;
  }

  $("form-agregar").reset();
  aviso("msg-agregar", "Producto guardado ✓ Puedes agregar otro.", "ok");
  $("nombre").focus();
  cargarProductos();
});

// ---------- Pantalla "Nuevo producto" ----------
$("ir-nuevo-producto").addEventListener("click", () => {
  $("form-agregar").reset();
  aviso("msg-agregar", "");
  irA("nuevoproducto");
});
