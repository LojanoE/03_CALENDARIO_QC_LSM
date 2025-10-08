// 🔴 ¡¡REEMPLAZA ESTA URL POR TU URL DE GOOGLE APPS SCRIPT!!
const API_URL = "https://script.google.com/macros/s/AKfycbw9gk9eK4VNDYI0kX9wv1iK4NKBd4NdMs4lCYdjzneC8JeVnB_EHuWTkOsfUIGTwkvO/exec";

let todosLosEventos = [];
let calendarInstance = null;
let eventoSeleccionado = null;

const colores = {
  "por hacer": "#bdbdbd",
  "en ejecución": "#ff9800",
  "terminado": "#4caf50"
};

document.addEventListener('DOMContentLoaded', function() {
  // Cargar eventos y configurar calendario
  fetch(API_URL)
    .then(response => response.json())
    .then(data => {
      todosLosEventos = data.map(item => ({
        id: item['ID'],
        title: `${item['Título']} (${item['Asignado a']})`,
        start: item['FechaInicio'],
        end: item['FechaFin'],
        backgroundColor: colores[item['Estado']] || "#9e9e9e",
        borderColor: colores[item['Estado']] || "#757575",
        extendedProps: {
          asignado: item['Asignado a'],
          descripcion: item['Descripción'] || 'Sin descripción',
          estado: item['Estado'] || 'por hacer',
          id: item['ID']
        }
      }));

      // Llenar dropdown de asignados
      const asignadosUnicos = [...new Set(data.map(d => d['Asignado a']).filter(x => x))];
      const selectAsignado = document.getElementById('filtroAsignado');
      asignadosUnicos.sort().forEach(nombre => {
        const option = document.createElement('option');
        option.value = nombre;
        option.textContent = nombre;
        selectAsignado.appendChild(option);
      });

      // Inicializar FullCalendar
      const calendarEl = document.getElementById('calendar');
      calendarInstance = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek'
        },
        events: todosLosEventos,
        eventClick: function(info) {
          const evento = info.event;
          eventoSeleccionado = evento;
          document.getElementById("modalEventoTitulo").innerText = evento.title;
          document.getElementById("nuevoEstado").value = evento.extendedProps.estado;
          document.getElementById("estadoModal").style.display = "block";
        }
      });
      calendarInstance.render();
    })
    .catch(err => {
      console.error("Error al cargar eventos:", err);
      document.getElementById("mensaje").textContent = "❌ No se pudieron cargar los eventos";
    });

  // Event listeners
  document.getElementById("btnGuardar").addEventListener("click", guardarEnGoogleSheet);
  document.getElementById("btnAplicarFiltros").addEventListener("click", aplicarFiltros);
  document.getElementById("btnLimpiarFiltros").addEventListener("click", limpiarFiltros);
  document.getElementById("btnGuardarEstado").addEventListener("click", actualizarEstado);
  document.getElementById("btnCancelarModal").addEventListener("click", cerrarModal);
});

// === FUNCIONES ===

function cerrarModal() {
  document.getElementById("estadoModal").style.display = "none";
  eventoSeleccionado = null;
}

function actualizarEstado() {
  if (!eventoSeleccionado) return;

  const nuevoEstado = document.getElementById("nuevoEstado").value;
  const idEvento = eventoSeleccionado.extendedProps.id;

  fetch(API_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ID: idEvento, Estado: nuevoEstado })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === "ok") {
      eventoSeleccionado.setProp('backgroundColor', colores[nuevoEstado]);
      eventoSeleccionado.setProp('borderColor', colores[nuevoEstado]);
      eventoSeleccionado.setExtendedProp('estado', nuevoEstado);
      cerrarModal();
      document.getElementById("mensaje").innerHTML = "✅ Estado actualizado";
      setTimeout(() => document.getElementById("mensaje").textContent = "", 3000);
    } else {
      alert("❌ Error al actualizar: " + (data.error || ""));
    }
  })
  .catch(err => alert("❌ Error de red: " + err.message));
}

function guardarEnGoogleSheet() {
  const inicio = document.getElementById("inicio").value;
  const fin = document.getElementById("fin").value;
  const titulo = document.getElementById("titulo").value;
  const asignado = document.getElementById("asignado").value;
  const descripcion = document.getElementById("descripcion").value || "";
  const estado = document.getElementById("estado").value;
  const mensaje = document.getElementById("mensaje");

  if (!inicio || !fin || !titulo || !asignado) {
    mensaje.textContent = "⚠️ Completa todos los campos obligatorios.";
    mensaje.style.color = "red";
    return;
  }

  if (new Date(fin) <= new Date(inicio)) {
    mensaje.textContent = "⚠️ La hora de fin debe ser posterior al inicio.";
    mensaje.style.color = "red";
    return;
  }

  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      FechaInicio: inicio,
      FechaFin: fin,
      Título: titulo,
      "Asignado a": asignado,
      Descripción: descripcion,
      Estado: estado
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === "ok") {
      mensaje.textContent = "✅ Actividad guardada. Recargando...";
      mensaje.style.color = "green";
      setTimeout(() => location.reload(), 1500);
    } else {
      mensaje.textContent = "❌ Error: " + (data.error || "Desconocido");
      mensaje.style.color = "red";
    }
  })
  .catch(err => {
    mensaje.textContent = "❌ Error de red: " + err.message;
    mensaje.style.color = "red";
  });
}

function aplicarFiltros() {
  const asignado = document.getElementById("filtroAsignado").value;
  const desde = document.getElementById("filtroDesde").value;
  const hasta = document.getElementById("filtroHasta").value;

  let eventosFiltrados = [...todosLosEventos];

  if (asignado) {
    eventosFiltrados = eventosFiltrados.filter(e => e.extendedProps.asignado === asignado);
  }

  if (desde || hasta) {
    const fechaDesde = desde ? new Date(desde) : null;
    const fechaHasta = hasta ? new Date(hasta) : null;
    if (fechaHasta) fechaHasta.setHours(23, 59, 59, 999);

    eventosFiltrados = eventosFiltrados.filter(e => {
      const inicioEvento = new Date(e.start);
      return (!fechaDesde || inicioEvento >= fechaDesde) &&
             (!fechaHasta || inicioEvento <= fechaHasta);
    });
  }

  calendarInstance.removeAllEventSources();
  calendarInstance.addEventSource(eventosFiltrados);

  if (desde) {
    calendarInstance.gotoDate(desde);
  }
}

function limpiarFiltros() {
  document.getElementById("filtroAsignado").value = "";
  document.getElementById("filtroDesde").value = "";
  document.getElementById("filtroHasta").value = "";
  calendarInstance.removeAllEventSources();
  calendarInstance.addEventSource(todosLosEventos);
  calendarInstance.today();
}