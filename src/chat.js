const saludo = '¡Aquí estamos al fin! He esperado una eternidad para conocerte. Tu vida estará dividida para siempre antes y después de conocerme. BIENVENIDO AL DESPUÉS.';

const CLAVE = 'chat-bill';
const MAX_GUARDADOS = 50; // el servidor acepta 60

// Lee el historial guardado y descarta lo que no tenga el formato esperado
function cargarHistorial() {
    try {
        const guardado = JSON.parse(localStorage.getItem(CLAVE));
        if (!Array.isArray(guardado)) return [];
        return guardado.filter(function(m) {
            return m && (m.role === 'user' || m.role === 'model') &&
                typeof m.text === 'string' && m.text !== '';
        });
    } catch {
        return [];
    }
}

const historial = cargarHistorial();

// Muestra u oculta el aviso de "Conversación guardada"
function actualizarIndicador() {
    const aviso = document.getElementById('chatGuardado');
    if (aviso) aviso.hidden = historial.length === 0;
}

// Recorta lo más viejo, se asegura de que empiece con un mensaje del usuario y guarda
function guardarHistorial() {
    while (historial.length > MAX_GUARDADOS) historial.shift();
    while (historial.length && historial[0].role === 'model') historial.shift();
    try {
        localStorage.setItem(CLAVE, JSON.stringify(historial));
    } catch {
        // almacenamiento lleno o bloqueado: el chat sigue funcionando sin guardar
    }

    actualizarIndicador();
}

async function obtenerRespuesta(mensajes) {
    const res = await fetch('/api/functions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensajes }),
    });

    const data = await res.json().catch(function() { return {}; });

    if (!res.ok) {
        const error = new Error(data.error || 'Error de red');
        error.status = res.status;
        throw error;
    }

    return data.respuesta;
}


// Scrollea hasta el ultimo mensaje
function bajarAlFinal(lista) {
    lista.scrollTo({ top: lista.scrollHeight, behavior: 'smooth' });
}

// Ajustar campo de texto para que se vea todo el contenido
function ajustarAltura(campo) {
    campo.style.height = 'auto';
    campo.style.height = (campo.scrollHeight + campo.offsetHeight - campo.clientHeight) + 'px';
}

function formatearHora(ms) {
    return new Date(ms).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

// Botón que copia la respuesta de Bill al portapapeles
function crearBotonCopiar(texto) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'message__copiar';
    boton.textContent = 'Copiar';
    boton.addEventListener('click', async function() {
        try {
            await navigator.clipboard.writeText(texto);
            boton.textContent = '¡Copiado!';
        } catch {
            boton.textContent = 'No se pudo';
        }
        setTimeout(function() { boton.textContent = 'Copiar'; }, 1500);
    });
    return boton;
}

// Genera una burbuja dependiendo el rol de quien lo envia e ingresa el texto.
// Si recibe hora, agrega el pie con la hora (y el botón de copiar en las de Bill)
function crearBurbuja(rol, texto, hora) {
    const burbuja = document.createElement('div');
    burbuja.className = 'message ' + (rol === 'user' ? 'message--user' : 'message--bot');

    const p = document.createElement('p');
    p.textContent = texto;
    burbuja.appendChild(p);

    if (hora) {
        const pie = document.createElement('div');
        pie.className = 'message__pie';

        const tiempo = document.createElement('time');
        tiempo.dateTime = new Date(hora).toISOString();
        tiempo.textContent = formatearHora(hora);
        pie.appendChild(tiempo);

        if (rol === 'model') pie.appendChild(crearBotonCopiar(texto));
        burbuja.appendChild(pie);
    }

    return burbuja;
}

// Genera el indicador de "Escribiendo..."
function crearIndicador() {
    const burbuja = document.createElement('div');
    burbuja.className = 'message message--bot message--typing';
    burbuja.setAttribute('role', 'status');
    burbuja.innerHTML =
        '<span class="typing-texto">Bill te escribe</span>' +
        '<span class="typing-puntos" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>';
    return burbuja;
}

// Genera un mensaje de error si falla
function burbujaError(texto) {
    const burbuja = crearBurbuja('model', texto);
    burbuja.classList.add('message--error');

    return burbuja;
}

function mensajeDeError(error) {
    if (error.status === 429) {
        return 'Bill se está hartando de ti. Espera un momento y vuelve a intentarlo.';
    }
    if (error.status === 400) {
        return 'Esta conversación ya es demasiado larga. Bórrala con el botón de la papelera para empezar de nuevo.';
    }
    if (error.status >= 500) {
        return 'Algo se rompió en el universo. Intenta de nuevo.';
    }
    return 'No pude contactar a Bill. Revisa tu conexión.';
}


// Genera el saludo y el historial guardado. Se borra con el botón de la papelera
export function iniciarChat() {
    const lista = document.getElementById('chatMessages');
    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatInput');
    const boton = form.querySelector('button');
    let esperando = false;

    lista.innerHTML = '';
    lista.appendChild(crearBurbuja('model', saludo));
    historial.forEach(function(mensaje) {
        lista.appendChild(crearBurbuja(mensaje.role, mensaje.text, mensaje.hora));
    });

    actualizarIndicador();
    bajarAlFinal(lista);

    // Genera una nueva burbuja al usar Enviar o Enter
    form.addEventListener('submit', async function(event) {
        // Previene que la pagina se recarge como accion por default
        event.preventDefault();

        const texto = input.value.trim();
        if (!texto || esperando) return;

        const horaUsuario = Date.now();
        historial.push({ role: 'user', text: texto, hora: horaUsuario });
        guardarHistorial();
        lista.appendChild(crearBurbuja('user', texto, horaUsuario));
        input.value = '';
        ajustarAltura(input);

        esperando = true;
        boton.disabled = true;

        const indicador = crearIndicador();
        lista.appendChild(indicador);
        bajarAlFinal(lista);

        try {
            // La función solo necesita role y text, sin la hora
            const mensajes = historial.map(function(m) {
                return { role: m.role, text: m.text };
            });
            const respuesta = await obtenerRespuesta(mensajes);

            const horaRespuesta = Date.now();
            historial.push({ role: 'model', text: respuesta, hora: horaRespuesta });
            guardarHistorial();
            indicador.replaceWith(crearBurbuja('model', respuesta, horaRespuesta));
        } catch (error) {
            indicador.replaceWith(burbujaError(mensajeDeError(error)));
        } finally {
            esperando = false;
            boton.disabled = false;
            input.focus();
            bajarAlFinal(lista);
        }
    });

    input.addEventListener('input', function() {
        ajustarAltura(input);
        bajarAlFinal(lista);
    });

    input.addEventListener('keydown', function(event) {
        const enterEnvia = event.key === 'Enter' && !event.shiftKey && !event.isComposing;
        if (enterEnvia && matchMedia('(pointer: fine)').matches) {
            event.preventDefault();
            form.requestSubmit();
        }
    });

    // Borra la conversación (el ?. evita errores si el botón no existe, como en los tests)
    document.getElementById('chatBorrar')?.addEventListener('click', function() {
        if (esperando) return;
        if (!confirm('¿Borrar la conversación con Bill?')) return;
        historial.length = 0;
        guardarHistorial();
        lista.innerHTML = '';
        lista.appendChild(crearBurbuja('model', saludo));
    });
}