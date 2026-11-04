import { describe, it, expect } from 'vitest';
import {
    validarMensajes,
    aFormatoGemini,
    extraerTexto,
    max_mensajes,
    max_caracteres,
} from '../src/utils.js';

describe('validrmensajes', function() {
    it('acepta un historial valido que termina con el usuario', function () {
        const mensajes = [
            { role: 'user', text: 'hola' },
            { role: 'model', text: 'qué aburrido' },
            { role: 'user', text: 'cuéntame más' },
        ];
        expect(validarMensajes(mensajes)).toBeNull();
    });

    it('rechaza algo que no es una lista, o una lista vacía', function() {
        expect(validarMensajes([])).toBe('Falta el historial de mensajes');
        expect(validarMensajes(undefined)).toBe('Falta el historial de mensajes');
    });

    it('rechaza un historial que termina con un mensaje del modelo', function() {
        const mensajes = [
            { role: 'user', text: 'hola' },
            { role: 'model', text: 'hola, humano' },
        ];
        expect(validarMensajes(mensajes)).toBe('El último mensaje debe ser del usuario');
    });

    it('rechaza roles inválidos y textos vacíos', function() {
        expect(validarMensajes([{ role: 'admin', text: 'hola' }])).toBe('Hay un mensaje con formato inválido');
        expect(validarMensajes([{ role: 'user', text: '   ' }])).toBe('Hay un mensaje con formato inválido');
    });

    it('rechaza un mensaje que sobrepasa el límite de caracteres', function() {
        const largo = 'a'.repeat(max_caracteres + 1);
        expect(validarMensajes([{ role: 'user', text: largo }])).toBe('Hay un mensaje con formato inválido');
    });

    it('rechaza un historial con demasiados mensajes', function () {
        const demasiados = Array.from({ length: max_mensajes + 1 }, function() {
            return { role: 'user', text: 'hola' };
        })
        expect(validarMensajes(demasiados)).toBe('El historial es demasiado largo');
    });
});


describe('aFormatoGemini', function() {
    it('convierte cada mensaje al formato Gemini', function() {
        const resultado = aFormatoGemini([
            { role: 'user', text: 'hola' },
            { role: 'model', text: 'hola, humano' },
        ]);

        expect(resultado).toEqual([
            { role: 'user', parts: [{ text: 'hola' }] },
            { role: 'model', parts: [{ text: 'hola, humano' }] },
        ]);
    });

    it('une los mensajes seguidos del mismo rol', function() {
        const resultado = aFormatoGemini([
            { role: 'user', text: 'primero' },
            { role: 'user', text: 'segundo' },
        ]);

        expect(resultado).toHaveLength(1);
        expect(resultado[0].parts[0].text).toBe('primero\nsegundo');
    });

    it('no modifica el arreglo original', function() {
        const original = [
            { role: 'user', text: 'uno' },
            { role: 'user', text: 'dos' },
        ];
        const copia = structuredClone(original);

        aFormatoGemini(original);
        expect(original).toEqual(copia);
    });
});


describe('extraerTexto', function() {
    it('saca el texto de la primera respuesta', function() {
        const data = {
            candidates: [{ content: { parts: [{ text: 'Hola amigo' }] } }],
        };

        expect(extraerTexto(data)).toBe('Hola amigo');
    });

    it('ignora las partes de razonamiento interno', function() {
        const data = {
            candidates: [{ content: { parts: [
                { text: 'pensando...', thought: true},
                { text: 'Respuesta final' },
            ]}}],
        };

        expect(extraerTexto(data)).toBe('Respuesta final');
    });

    it('devuelve null si la respuesta viene vacía o sin candidatos', function() {
        expect(extraerTexto(undefined)).toBeNull();
        expect(extraerTexto({})).toBeNull();
        expect(extraerTexto({ candidates: [] })).toBeNull();
        expect(extraerTexto({ candidates: [{ content: { parts: [{ text: '' }] } }] })).toBeNull();
    });
});