// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { iniciarChat } from '../src/chat.js';

vi.mock('../src/chat.js', function() {
    return { iniciarChat: vi.fn() };
});

let rutaInicial;
let vistaInicial;

function irA(ruta) {
    history.pushState({}, '', ruta);
    window.dispatchEvent(new PopStateEvent('popstate'));
}

function hacerClic(selector) {
    const elemento = document.querySelector(selector);
    const evento = new MouseEvent('click', { bubbles: true, cancelable: true });
    elemento.dispatchEvent(evento);
    return evento;
}

beforeAll(async function() {
    document.body.innerHTML = `
        <main id="app"></main>
        <button id="externo">fuera de los links</button>

        <template id="vista-home">
            <section>
                <h1>Home</h1>
                <a href="/chat" data-link>Chat</a>
                <a href="/universos" data-link>Universos</a>
                <a href="/about" data-link>About</a>
            </section>
        </template>
        <template id="vista-chat">
            <section><h1>Chat</h1><a href="/home" data-link>Volver</a></section>
        </template>
        <template id="vista-universos">
            <section><h1>Universos</h1><a href="/home" data-link>Volver</a></section>
        </template>
        <template id="vista-about">
            <section><h1>El trato</h1><a href="/home" data-link>Volver</a></section>
        </template>`;

    history.replaceState({}, '', '/');
    await import('../src/app.js');

    rutaInicial = location.pathname;
    vistaInicial = document.body.dataset.vista;
});

beforeEach(function() {
    iniciarChat.mockClear();
});

describe('routing SPA', function() {
    it('redirige la raíz a /home al cargar', function() {
        expect(rutaInicial).toBe('/home');
        expect(vistaInicial).toBe('home');
    });

    it('pinta la vista que corresponde a la URL', function() {
        irA('/about');

        expect(document.body.dataset.vista).toBe('about');
        expect(document.querySelector('#app h1').textContent).toBe('El trato');
    });

    it('cae en el Home si la ruta no existe', function() {
        irA('/no-existe');

        expect(document.body.dataset.vista).toBe('home');
        expect(document.querySelector('#app h1').textContent).toBe('Home');
    });

    it('un link con data-link navega sin recargar la página', function() {
        irA('/home');

        const evento = hacerClic('#app a[href="/chat"]');

        expect(evento.defaultPrevented).toBe(true);
        expect(location.pathname).toBe('/chat');
        expect(document.body.dataset.vista).toBe('chat');
    });

    it('inicia el chat solo al entrar a /chat', function() {
        irA('/about');
        expect(iniciarChat).not.toHaveBeenCalled();

        irA('/chat');
        expect(iniciarChat).toHaveBeenCalledTimes(1);
    });

    it('ignora los clics que no son de un link con data-link', function() {
        irA('/home');

        const evento = hacerClic('#externo');

        expect(evento.defaultPrevented).toBe(false);
        expect(location.pathname).toBe('/home');
    });

    it('los botones atrás y adelante del navegador cambian la vista', async function() {
        irA('/home');
        hacerClic('#app a[href="/about"]');
        expect(location.pathname).toBe('/about');

        history.back();
        await vi.waitFor(function() {
            expect(document.body.dataset.vista).toBe('home');
        });

        history.forward();
        await vi.waitFor(function() {
            expect(document.body.dataset.vista).toBe('about');
        });
    });
});