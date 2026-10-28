const saludo = '¡Aquí estamos al fin! He esperado una eternidad para conocerte. Tu vida estará dividida para siempre antes y después de conocerme. BIENVENIDO AL DESPUÉS.';

const historial = [];


//  Simulacion "escribiendo..." antes de respuesta
const respuestas_falsas = [
    'Mmm, qué pregunta tan aburrida. Intenta otra.',
    'Te escucho, humano. Siempre te escucho.',
    'Eso tiene un precio. Todo lo tiene.',
    'Cuéntame más. Los secretos me abren el apetito.',
];

// Temporizador que simula demaro de la respuesta
function esperar(ms) {
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
    });
}

async function obtenerRespuesta(mensajes) {
    await esperar(2000);

    const ultimo = mensajes[mensajes.length - 1].text;
    if (ultimo.toLowerCase() === 'error') {
        throw new Error('Error simulado');
    }

    return respuestas_falsas[mensajes.length % respuestas_falsas.length];
}


// Scrollea hasta el ultimo mensaje
function bajarAlFinal(lista) {
    lista.scrollTo({ top: lista.scrollHeight, behavior: 'smooth' });
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
// Genera un mensaje de erro si falla
function burbujaError() {
    const burbuja = crearBurbuja('model', 'Algo horrible pasó y no quieres saber que es jaja. Intenta de nuevo.');
    burbuja.classList.add('message--error');
    
    return burbuja;
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
            indicador.replaceWith(burbujaError());
        } finally {
            esperando = false;
            boton.disabled = false;
            input.focus();
            bajarAlFinal(lista);
        }
    });
}