import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../api/functions.js';

function crearRes() {
    const res = {
        codigo: null,
        cuerpo: null,
        status: function(codigo) { res.codigo = codigo; return res; },
        json: function(cuerpo) { res.cuerpo = cuerpo; return res; },
    };
    return res;
}

function crearReq(mensajes) {
    return { method: 'POST', body: { mensajes: mensajes } };
}

const MENSAJES_VALIDOS = [{ role: 'user', text: 'Hola, ¿quién eres?' }];

function respuestaGeminiOk(texto) {
    return {
        ok: true,
        json: async function() {
            return { candidates: [{ content: { parts: [{ text: texto }] } }] };
        },
    };
}

beforeEach(function() {
    vi.stubEnv('GEMINI_API_KEY', 'clave-de-prueba');
    vi.stubEnv('GEMINI_MODEL', 'modelo-de-prueba');
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(function() {});
});

afterEach(function() {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('función serverless /api/functions', function() {
    it('rechaza métodos que no son POST con un 405', async function() {
        const res = crearRes();
        await handler({ method: 'GET' }, res);

        expect(res.codigo).toBe(405);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('responde 500 si falta la configuración del servidor', async function() {
        vi.stubEnv('GEMINI_API_KEY', '');

        const res = crearRes();
        await handler(crearReq(MENSAJES_VALIDOS), res);

        expect(res.codigo).toBe(500);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('responde 400 y no llama a Gemini si el historial es inválido', async function() {
        const res = crearRes();
        await handler(crearReq([{ role: 'model', text: 'hola' }]), res);

        expect(res.codigo).toBe(400);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('devuelve la respuesta de Gemini con un 200', async function() {
        fetch.mockResolvedValue(respuestaGeminiOk('Hola, humano.'));

        const res = crearRes();
        await handler(crearReq(MENSAJES_VALIDOS), res);

        expect(res.codigo).toBe(200);
        expect(res.cuerpo).toEqual({ respuesta: 'Hola, humano.' });
    });

    it('envía la clave en un header y no en la URL', async function() {
        fetch.mockResolvedValue(respuestaGeminiOk('ok'));

        await handler(crearReq(MENSAJES_VALIDOS), crearRes());

        const [url, opciones] = fetch.mock.calls[0];
        expect(url).toContain('modelo-de-prueba');
        expect(url).not.toContain('clave-de-prueba');
        expect(opciones.headers['x-goog-api-key']).toBe('clave-de-prueba');
    });

    it('manda el historial y el prompt del personaje a Gemini', async function() {
        fetch.mockResolvedValue(respuestaGeminiOk('ok'));

        await handler(crearReq(MENSAJES_VALIDOS), crearRes());

        const cuerpo = JSON.parse(fetch.mock.calls[0][1].body);
        expect(cuerpo.contents).toEqual([
            { role: 'user', parts: [{ text: 'Hola, ¿quién eres?' }] },
        ]);
        expect(cuerpo.systemInstruction.parts[0].text).toContain('Bill Cipher');
    });

    it('traduce un 429 de Gemini a un 429 para el cliente', async function() {
        fetch.mockResolvedValue({ ok: false, status: 429, text: async function() { return 'cuota'; } });

        const res = crearRes();
        await handler(crearReq(MENSAJES_VALIDOS), res);

        expect(res.codigo).toBe(429);
    });

    it('responde 502 sin filtrar los detalles del error de Gemini', async function() {
        fetch.mockResolvedValue({
            ok: false,
            status: 500,
            text: async function() { return 'detalle-secreto-interno'; },
        });

        const res = crearRes();
        await handler(crearReq(MENSAJES_VALIDOS), res);

        expect(res.codigo).toBe(502);
        expect(JSON.stringify(res.cuerpo)).not.toContain('detalle-secreto-interno');
        expect(console.error).toHaveBeenCalled();
    });

    it('responde 502 si Gemini no devuelve texto', async function() {
        fetch.mockResolvedValue({ ok: true, json: async function() { return { candidates: [] }; } });

        const res = crearRes();
        await handler(crearReq(MENSAJES_VALIDOS), res);

        expect(res.codigo).toBe(502);
    });

    it('responde 500 si la red falla por completo', async function() {
        fetch.mockRejectedValue(new Error('sin red'));

        const res = crearRes();
        await handler(crearReq(MENSAJES_VALIDOS), res);

        expect(res.codigo).toBe(500);
    });
});