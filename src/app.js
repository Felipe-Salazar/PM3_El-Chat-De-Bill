const app = document.getElementById('app');

// Le nombra a cada ID su enlace 
const rutas =  {
    '/home': 'vista-home',
    '/chat': 'vista-chat',
    '/about': 'vista-about',
    '/universos': 'vista-universos',
};

// Rederizar las paginas solicitadas por su Enlace (ID)
function render() {
    const ruta = rutas[location.pathname] ? location.pathname : '/home';
    const plantilla = document.getElementById(rutas[ruta]);

    document.body.dataset.vista = ruta.slice(1);
    app.innerHTML = '';
    app.appendChild(plantilla.content.cloneNode(true));
}

// Cambia la URL a su respectivo enlace y lo agrega al historial
function navegar(ruta) {
    history.pushState({}, '', ruta);
    render();
}

// // ABusca el link que tiene data-link y le asigna el evento para navegar 
document.addEventListener('click', function(event) {
    const link = event.target.closest('[data-link]');
    if (!link) return;

    // Previene cargar otra pagina por defecto
    event.preventDefault();
    navegar(link.getAttribute('href'));
});

// No genera una nueva pila del historia solo pinta la pagina de adelante o atras
window.addEventListener('popstate', render);

if (location.pathname === '/') history.replaceState({}, '', '/home');

render();