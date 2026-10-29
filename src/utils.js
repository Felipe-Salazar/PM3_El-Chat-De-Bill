export const max_mensajes = 60;
export const max_caracteres = 1000;


// Valida si el historial se agrega, que no sea largo y que el último mensaje sea del 'user'
export function validarMensajes(mensajes) {
    if (!Array.isArray(mensajes) || mensajes.length === 0) {
        return 'Falta el historial de mensajes';
    }

    if (mensajes.length > max_mensajes) {
        return 'El historial es demasiado largo';
    }

    for (const m of mensajes) {
        const rolValido = m && (m.role === 'user' || m.role === 'model');
        const textoValido = m && typeof m.text === 'string' && m.text.trim() !== '' && m.text.length <= max_caracteres;

        if (!rolValido || !textoValido) {
            return 'Hay un mensaje con formato inválido';
        }
    }

    if (mensajes[mensajes.length - 1].role !== 'user') {
        return 'El último mensaje debe ser del usuario';
    }

    return null;
}


// Genera un historial de mensajes en formato Gemini y combina los mensajes consecutivos del mismo rol
export function aFormatoGemini (mensajes) {
    const contents = [];

    for (const m of mensajes) {
        const ultimo = contents[contents.length - 1];

        if (ultimo && ultimo.role === m.role) {
            ultimo.parts[0].text += '\n' + m.text;
        } else {
            contents.push({ role: m.role, parts: [{ text: m.text }] });
        }
    }

    return contents;
}


// Extrae el texto de la respuesta de Gemini y si no hay texto devuelve null
export function extraerTexto(data) {
    const partes = data?.candidates?.[0]?.content?.parts;

    if (!Array.isArray(partes)) return null;

    const texto = partes
        .filter(function(p) { return typeof p.text === 'string' && !p.thought; })
        .map(function(p) { return p.text; })
        .join('')
        .trim();

    return texto || null;
}