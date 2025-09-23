// --- IndexedDB para guardar imágenes ---
let db;
const request = indexedDB.open("InventarioDB", 1);

request.onupgradeneeded = function (e) {
  db = e.target.result;
  if (!db.objectStoreNames.contains("imagenes")) {
    db.createObjectStore("imagenes");
  }
};

request.onsuccess = function (e) {
  db = e.target.result;
  mostrarProductos();
};

request.onerror = function (e) {
  console.error("Error con IndexedDB", e);
};

// Guardar imagen en IndexedDB
function guardarImagen(key, blob) {
  const tx = db.transaction("imagenes", "readwrite");
  tx.objectStore("imagenes").put(blob, key);
}

// Obtener imagen de IndexedDB
function obtenerImagen(key, callback) {
  const tx = db.transaction("imagenes", "readonly");
  const req = tx.objectStore("imagenes").get(key);
  req.onsuccess = () => callback(req.result);
}

// --- Inventario actual ---
let productos = JSON.parse(localStorage.getItem("productos")) || [];
let tituloGuardado = localStorage.getItem("tituloInventario");
let estadoAbierto = JSON.parse(localStorage.getItem("estadoAbierto")) || {};

if (tituloGuardado) {
  document.getElementById("tituloEditable").textContent = tituloGuardado;
}

document.getElementById("tituloEditable").addEventListener("input", () => {
  localStorage.setItem(
    "tituloInventario",
    document.getElementById("tituloEditable").textContent.trim()
  );
});

document.getElementById("toggleFormulario").addEventListener("click", () => {
  const form = document.getElementById("formulario");
  form.style.display = form.style.display === "none" ? "block" : "none";
});

function guardarProductos() {
  localStorage.setItem("productos", JSON.stringify(productos));
}

// --- Notificaciones ---
function mostrarNotificacion(mensaje, tipo = "exito") {
  const contenedor = document.getElementById("notificaciones");
  const toast = document.createElement("div");
  toast.className = "toast";

  if (tipo === "error") toast.style.background = "#f44336"; // rojo si es error

  toast.textContent = mensaje;
  contenedor.appendChild(toast);

  // Eliminar después de 3s
  setTimeout(() => {
    toast.remove();
  }, 3000);
}


// --- Mostrar productos + contador ---
function mostrarProductos(filtro = "") {
  const lista = document.getElementById("lista");
  lista.innerHTML = "";

  let total = 0;

  productos.forEach((p, i) => {
    if (filtro && !p.nombre.toLowerCase().includes(filtro.toLowerCase())) return;

    const div = document.createElement("div");
    div.className = "producto";
    const estaAbierto = estadoAbierto[i] || false;

    // Contar cantidades
    p.variantes.forEach(v => total += v.cantidad);

    let tabla = `
      <div class="producto-info" id="info-${i}" style="display: ${estaAbierto ? "block" : "none"}">
        <table>
          <tr><th>Color</th><th>Talla</th><th>Cantidad</th></tr>
          ${p.variantes.map((v, j) => `
            <tr>
              <td>${v.color}</td>
              <td>${v.talla}</td>
              <td class="cantidad-controles">
                <button onclick="restar(${i}, ${j})">-</button>
                <input type="number" min="0" value="${v.cantidad}" 
                       onchange="actualizarCantidad(${i}, ${j}, this.value)" 
                       onkeydown="if(event.key==='Enter'){this.blur();}" 
                       style="width: 50px; text-align:center;">
                <button onclick="sumar(${i}, ${j})">+</button>
              </td>
            </tr>
          `).join("")}
        </table>
        <button onclick="eliminarProducto(${i})" class="btn-eliminar">Eliminar producto</button>
      </div>
    `;

    div.innerHTML = `
      <div>
        <img id="img-${i}" alt="${p.nombre}">
        <div>
          <strong>${p.nombre}</strong><br>
          <div><span class="label">Precio público:</span> <span class="value">$${p.precioPublico.toFixed(2)}</span></div>
          <div><span class="label">Precio permitido:</span> <span class="value">${p.precioPermitido !== null ? `$${p.precioPermitido.toFixed(2)}` : "N/A"}</span></div>
          <button class="btn-toggle" onclick="toggleTabla(${i})">Mostrar/ocultar info</button>
        </div>
      </div>
      ${tabla}
    `;

    // Recuperar imagen desde IndexedDB
    if (p.fotoKey) {
      obtenerImagen(p.fotoKey, (blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          document.getElementById(`img-${i}`).src = url;
        }
      });
    } else if (p.foto) {
      document.getElementById(`img-${i}`).src = p.foto; // Compatibilidad con datos antiguos
    }

    lista.appendChild(div);
  });

  // Mostrar total
  document.getElementById("totalInventario").textContent =
    `Total en inventario: ${total} unidades`;

  localStorage.setItem("estadoAbierto", JSON.stringify(estadoAbierto));
}

// --- Funciones de control ---
function toggleTabla(i) {
  const info = document.getElementById(`info-${i}`);
  const visible = info.style.display === 'block';
  info.style.display = visible ? 'none' : 'block';
  estadoAbierto[i] = !visible;
  localStorage.setItem('estadoAbierto', JSON.stringify(estadoAbierto));
}

function sumar(i, j) {
  productos[i].variantes[j].cantidad++;
  guardarProductos();
  mostrarProductos(document.getElementById('busqueda').value);
}

function restar(i, j) {
  if (productos[i].variantes[j].cantidad > 0) {
    productos[i].variantes[j].cantidad--;
    guardarProductos();
    mostrarProductos(document.getElementById('busqueda').value);
  }
}

function actualizarCantidad(i, j, valor) {
  let cantidad = parseInt(valor);
  if (isNaN(cantidad) || cantidad < 0) cantidad = 0;
  productos[i].variantes[j].cantidad = cantidad;
  guardarProductos();
  mostrarProductos(document.getElementById('busqueda').value);
}

function eliminarProducto(i) {
  if (confirm("¿Seguro que deseas eliminar este producto?")) {
    productos.splice(i, 1);
    delete estadoAbierto[i];
    guardarProductos();
    mostrarProductos(document.getElementById('busqueda').value);
  }
}

// --- Agregar producto ---
document.getElementById("formulario").addEventListener("submit", e => {
  e.preventDefault();

  const nombre = document.getElementById("nombre").value;
  const colores = document.getElementById("color").value.split(",").map(c => c.trim());
  const tallas = document.getElementById("talla").value.split(",").map(t => t.trim());
  const precioPublico = parseFloat(document.getElementById("precioPublico").value);
  const precioPermitido = parseFloat(document.getElementById("precioPermitido").value) || null;
  const fotoInput = document.getElementById("foto");

  const variantes = [];
  colores.forEach(color => {
    tallas.forEach(talla => {
      variantes.push({ color, talla, cantidad: 0 });
    });
  });

  const fotoKey = `producto-${Date.now()}`;

 function agregarConFoto() {
  productos.push({ nombre, precioPublico, precioPermitido, fotoKey, variantes });
  guardarProductos();

  // abrir automáticamente el producto recién agregado
  estadoAbierto[productos.length - 1] = true;
  localStorage.setItem("estadoAbierto", JSON.stringify(estadoAbierto));

  mostrarProductos();
  mostrarNotificacion("✅ Producto guardado con éxito");

  document.getElementById("formulario").reset();
}

if (fotoInput.files.length) {
  const file = fotoInput.files[0];
  guardarImagen(fotoKey, file);
  agregarConFoto();
} else {
  // Compatibilidad: si no hay foto, usamos placeholder
  productos.push({ nombre, precioPublico, precioPermitido, foto: "https://via.placeholder.com/100", variantes });
  guardarProductos();

  // abrir automáticamente el producto recién agregado
  estadoAbierto[productos.length - 1] = true;
  localStorage.setItem("estadoAbierto", JSON.stringify(estadoAbierto));

  mostrarProductos();
  document.getElementById("formulario").reset();
  mostrarNotificacion("✅ Producto guardado con éxito");
}

}); // <- cierre correcto del addEventListener


// --- Buscador ---
document.getElementById("busqueda").addEventListener("input", (e) => {
  mostrarProductos(e.target.value);
});

// --- Exportar a Excel ---
function exportarAExcel() {
  if (productos.length === 0) {
    alert("No hay productos para exportar.");
    return;
  }

  const filas = [];
  filas.push([
    "Nombre Producto",
    "Precio Público",
    "Precio Permitido",
    "Color",
    "Talla",
    "Cantidad"
  ]);

  productos.forEach(p => {
    p.variantes.forEach(v => {
      filas.push([
        p.nombre,
        p.precioPublico,
        p.precioPermitido !== null ? p.precioPermitido : "N/A",
        v.color,
        v.talla,
        v.cantidad
      ]);
    });
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(filas);
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");

  XLSX.writeFile(wb, "inventario_productos.xlsx");
}

document.getElementById("exportExcel").addEventListener("click", exportarAExcel);

// --- Inicializar ---
mostrarProductos();
