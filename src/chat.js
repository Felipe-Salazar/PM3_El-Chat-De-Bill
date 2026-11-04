const saludo = '¡Aquí estamos al fin! He esperado una eternidad para conocerte. Tu vida estará dividida para siempre antes y después de conocerme. BIENVENIDO AL DESPUÉS.';

const historial = [];

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

// Genera una burbuja dependiendo el rol de quien lo envia e ingresa el texto
function crearBurbuja(rol, texto) {
    const burbuja = document.createElement('div');
    burbuja.className = 'message ' + (rol === 'user' ? 'message--user' : 'message--bot');

    const p = document.createElement('p');
    p.textContent = texto;

    burbuja.appendChild(p);
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
        return 'Esta conversación ya es demasiado larga. Recarga la página para empezar de nuevo.';
    }
    if (error.status >= 500) {
        return 'Algo se rompió en el universo. Intenta de nuevo.';
    }
    return 'No pude contactar a Bill. Revisa tu conexión.';
}


// Genera el saludo y tambien el historial, solo se borra con F5
export function iniciarChat() {
    const lista = document.getElementById('chatMessages');
    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatInput');
    const boton = form.querySelector('button');
    let esperando = false;

    lista.innerHTML = '';
    lista.appendChild(crearBurbuja('model', saludo));
    historial.forEach(function(mensaje) {
        lista.appendChild(crearBurbuja(mensaje.role, mensaje.text));
    });
    
    bajarAlFinal(lista);

    // Genera una nueva burbuja al usar Enviar o Enter
    form.addEventListener('submit', async function(event) {
        // Previene que la pagina se recarge como accion por default
        event.preventDefault();

        const texto = input.value.trim();
        if (!texto || esperando) return;

        historial.push({ role: 'user', text: texto });
        lista.appendChild(crearBurbuja('user', texto));
        input.value = '';
        ajustarAltura(input);

        esperando = true;
        boton.disabled = true;

        const indicador = crearIndicador();
        lista.appendChild(indicador);
        bajarAlFinal(lista);

        try {
            const respuesta = await obtenerRespuesta(historial);
            historial.push({ role: 'model', text: respuesta});
            indicador.replaceWith(crearBurbuja('model', respuesta));
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
}