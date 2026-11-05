// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let iniciarChat;
let lista;
let form;
let input;
let boton;

function montarChat() {
    document.body.innerHTML = `
        <div class="chat-container">
            <div class="chat-messages" id="chatMessages"></div>
            <form id="chatForm">
                <textarea id="chatInput" maxlength="1000"></textarea>
                <button type="submit">Enviar</button>
            </form>
        </div>`;

    lista = document.getElementById('chatMessages');
    form = document.getElementById('chatForm');
    input = document.getElementById('chatInput');
    boton = form.querySelector('button');
}

function enviar(texto) {
    input.value = texto;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function respuestaOk(texto) {
    return { ok: true, json: async function() { return { respuesta: texto }; } };
}

function respuestaError(status) {
    return { ok: false, status: status, json: async function() { return { error: 'fallo' }; } };
}

async function esperarFin() {
    await vi.waitFor(function() {
        expect(lista.querySelector('.message--typing')).toBeNull();
    });
}

beforeEach(async function() {
    localStorage.clear();
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
    Element.prototype.scrollTo = vi.fn();
    montarChat();
    ({ iniciarChat } = await import('../src/chat.js'));
});

afterEach(function() {
    vi.unstubAllGlobals();
    delete Element.prototype.scrollTo;
    document.body.innerHTML = '';
});

describe('chat', function() {
    it('pinta el saludo de Bill al iniciar', function() {
        iniciarChat();

        const burbujas = lista.querySelectorAll('.message--bot');
        expect(burbujas).toHaveLength(1);
        expect(burbujas[0].textContent).toContain('BIENVENIDO AL DESPUÉS');
    });

    it('muestra el mensaje del usuario y limpia el campo', async function() {
        fetch.mockResolvedValue(respuestaOk('Te escucho.'));
        iniciarChat();

        enviar('Hola, Bill');
        await esperarFin();

        const mensajes = lista.querySelectorAll('.message--user');
        expect(mensajes).toHaveLength(1);
        expect(mensajes[0].querySelector('p').textContent).toBe('Hola, Bill');
        expect(input.value).toBe('');
    });

    it('envía el historial a la función con un POST', async function() {
        fetch.mockResolvedValue(respuestaOk('Te escucho.'));
        iniciarChat();

        enviar('Hola, Bill');
        await esperarFin();

        expect(fetch).toHaveBeenCalledTimes(1);
        const [url, opciones] = fetch.mock.calls[0];
        expect(url).toBe('/api/functions');
        expect(opciones.method).toBe('POST');
        expect(JSON.parse(opciones.body)).toEqual({
            mensajes: [{ role: 'user', text: 'Hola, Bill' }],
        });
    });

    it('muestra "escribiendo" mientras espera y lo reemplaza por la respuesta', async function() {
        let resolver;
        fetch.mockReturnValue(new Promise(function(resolve) { resolver = resolve; }));
        iniciarChat();

        enviar('Hola, Bill');
        expect(lista.querySelector('.message--typing')).not.toBeNull();

        resolver(respuestaOk('Qué aburrido eres.'));
        await esperarFin();

        const bots = lista.querySelectorAll('.message--bot');
        expect(bots[bots.length - 1].querySelector('p').textContent).toBe('Qué aburrido eres.');
    });

    it('no envía mensajes vacíos', function() {
        iniciarChat();

        enviar('   ');

        expect(fetch).not.toHaveBeenCalled();
    });

    it('no deja enviar otro mensaje mientras Bill responde', async function() {
        let resolver;
        fetch.mockReturnValue(new Promise(function(resolve) { resolver = resolve; }));
        iniciarChat();

        enviar('primero');
        expect(boton.disabled).toBe(true);

        enviar('segundo');
        expect(fetch).toHaveBeenCalledTimes(1);

        resolver(respuestaOk('ok'));
        await esperarFin();
        expect(boton.disabled).toBe(false);
    });

    it('la segunda petición incluye todo el historial', async function() {
        fetch
            .mockResolvedValueOnce(respuestaOk('Primera respuesta'))
            .mockResolvedValueOnce(respuestaOk('Segunda respuesta'));
        iniciarChat();

        enviar('uno');
        await esperarFin();
        enviar('dos');
        await esperarFin();

        const cuerpo = JSON.parse(fetch.mock.calls[1][1].body);
        expect(cuerpo.mensajes).toEqual([
            { role: 'user', text: 'uno' },
            { role: 'model', text: 'Primera respuesta' },
            { role: 'user', text: 'dos' },
        ]);
    });

    it('muestra un error específico cuando el servidor responde 429', async function() {
        fetch.mockResolvedValue(respuestaError(429));
        iniciarChat();

        enviar('Hola');
        await esperarFin();

        const error = lista.querySelector('.message--error');
        expect(error).not.toBeNull();
        expect(error.textContent).toContain('Espera un momento');
    });

    it('muestra un error de conexión si falla la red', async function() {
        fetch.mockRejectedValue(new Error('sin red'));
        iniciarChat();

        enviar('Hola');
        await esperarFin();

        const error = lista.querySelector('.message--error');
        expect(error).not.toBeNull();
        expect(error.textContent).toContain('conexión');
    });

    it('no guarda el error en el historial', async function() {
        fetch
            .mockResolvedValueOnce(respuestaError(500))
            .mockResolvedValueOnce(respuestaOk('ok'));
        iniciarChat();

        enviar('primero');
        await esperarFin();
        enviar('segundo');
        await esperarFin();

        const cuerpo = JSON.parse(fetch.mock.calls[1][1].body);
        expect(cuerpo.mensajes).toEqual([
            { role: 'user', text: 'primero' },
            { role: 'user', text: 'segundo' },
        ]);
    });

    it('conserva la conversación al volver a abrir el chat', async function() {
        fetch.mockResolvedValue(respuestaOk('Respuesta de Bill'));
        iniciarChat();
        enviar('Hola');
        await esperarFin();

        montarChat();
        iniciarChat();

        const textos = Array.from(lista.querySelectorAll('.message')).map(function(m) {
            return m.querySelector('p').textContent;
        });
        expect(textos).toHaveLength(3);
        expect(textos[1]).toBe('Hola');
        expect(textos[2]).toBe('Respuesta de Bill');
    });

    it('trata el texto como texto plano y no como HTML', async function() {
        fetch.mockResolvedValue(respuestaOk('<img src="x" onerror="alert(1)">'));
        iniciarChat();

        enviar('<b>hola</b>');
        await esperarFin();

        expect(lista.querySelector('b')).toBeNull();
        expect(lista.querySelector('img')).toBeNull();
        expect(lista.textContent).toContain('<b>hola</b>');
    });

    it('Enter envía el mensaje y Shift+Enter no', async function() {
        vi.stubGlobal('matchMedia', function() { return { matches: true }; });
        fetch.mockResolvedValue(respuestaOk('ok'));
        iniciarChat();

        input.value = 'con shift';
        input.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter', shiftKey: true, bubbles: true, cancelable: true,
        }));
        expect(fetch).not.toHaveBeenCalled();

        input.value = 'con enter';
        input.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter', bubbles: true, cancelable: true,
        }));
        await esperarFin();

        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('baja al último mensaje cuando llega una respuesta', async function() {
        fetch.mockResolvedValue(respuestaOk('ok'));
        iniciarChat();
        Element.prototype.scrollTo.mockClear();

        enviar('Hola');
        await esperarFin();

        expect(Element.prototype.scrollTo).toHaveBeenCalled();
    });
});