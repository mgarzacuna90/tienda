// ===== inicio.js: entrar, salir y arranque (este archivo va al final) =====

// ---------- Entrar ----------
$("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const boton = $("btn-entrar");
  boton.disabled = true;
  aviso("msg-login", "");

  const { error } = await db.auth.signInWithPassword({
    email: $("correo").value.trim(),
    password: $("clave").value,
  });

  boton.disabled = false;
  if (error) {
    aviso("msg-login", "Correo o contraseña incorrectos. Revísalos e intenta otra vez.", "error");
  }
  // Si todo sale bien, onAuthStateChange (abajo) cambia la pantalla solo.
});

// ---------- Salir ----------
document.querySelectorAll(".js-salir").forEach((boton) => {
  boton.addEventListener("click", async () => {
    await db.auth.signOut();
  });
});

db.auth.onAuthStateChange((_evento, sesion) => {
  // setTimeout evita que Supabase se trabe al hacer otras consultas aquí dentro.
  setTimeout(() => mostrar(Boolean(sesion)), 0);
});

// ---------- Mantener la información al día ----------
// Al volver a abrir la app se recarga todo, para ver lo que hizo la otra persona.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !$("pie").hidden) {
    cargarProductos();
    cargarClientes();
  }
});

// ---------- Enlace del catálogo público ----------
$("copiar-catalogo").addEventListener("click", async () => {
  const enlace = new URL("catalogo.html", window.location.href).href;
  try {
    await navigator.clipboard.writeText(enlace);
    aviso("msg-editar", "Enlace copiado ✓ Pégalo en WhatsApp para compartir tu catálogo.", "ok");
  } catch (err) {
    aviso("msg-editar", "No se pudo copiar. Tu enlace es: " + enlace, "error");
  }
});

// ---------- Al abrir la página ----------
db.auth.getSession().then(({ data }) => mostrar(Boolean(data.session)));
