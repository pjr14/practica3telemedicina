// public_rpc/app_rpc.js

const app = rpc("localhost", "app_sanitario");

// Referencias a los procedimientos remotos
const loginSanitarioRPC = app.procedure("loginSanitario");
const obtenerSanitarioRPC = app.procedure("obtenerSanitario");
const crearSanitarioRPC = app.procedure("crearSanitario");
const obtenerRecursosRPC = app.procedure("obtenerRecursos");
const tiempoPendienteRPC = app.procedure("tiempoPendiente");
const reservarRecursoRPC = app.procedure("reservarRecurso");
const iniciarReservaRPC = app.procedure("iniciarReserva");
const obtenerReservasRPC = app.procedure("obtenerReservas");
const cancelarReservaRPC = app.procedure("cancelarReserva");
const finalizarReservaRPC = app.procedure("finalizarReserva");
const obtenerRecursoRPC = app.procedure("obtenerRecurso");
const crearResenyaRPC = app.procedure("crearResenya");
const actualizarSanitarioRPC = app.procedure("actualizarSanitario");
const obtenerRecursoPorCodigoRPC = app.procedure("obtenerRecursoPorCodigo");


// Variables globales
let sanitarioActualId = null;
let conexionWS = null; // Para guardar la conexión de WebSockets

// --- NAVEGACIÓN ---
function mostrarPantalla(idPantalla) {
    let pantallas = document.querySelectorAll('.pantalla');
    pantallas.forEach(p => p.classList.remove('activa'));
    document.getElementById(idPantalla).classList.add('activa');
}

// --- LOGIN Y REGISTRO ---
function hacerLogin() {
    let usu = document.getElementById("login-usu").value;
    let pass = document.getElementById("login-pass").value;

    loginSanitarioRPC(usu, pass, function(idDevuelto) {
        if (idDevuelto !== null) {
            sanitarioActualId = idDevuelto;
            
            // Si el login va bien, pedimos los datos reales
            obtenerSanitarioRPC(sanitarioActualId, function(datosSanitario) {
                document.getElementById("bienvenida-nombre").innerText = "Bienvenido/a, " + datosSanitario.nombre + " " + datosSanitario.apellidos;
                mostrarPantalla('pantalla-inicio');
                
                cargarFiltrosBuscador(); // Cargamos los filtros del buscador nada más iniciar sesión, para que estén listos cuando el sanitario vaya a la pantalla de búsqueda
                cargarMisReservas(); // Cargamos las reservas del sanitario para que estén listas en su pantalla de reservas

                conectarWebSocketsSanitario(); // ¡Conectamos a WebSockets al hacer login exitoso!
            });
        } else {
            alert("Usuario o contraseña incorrectos");
        }
    });
}

function cerrarSesion() {
    sanitarioActualId = null;
    document.getElementById("login-usu").value = "";
    document.getElementById("login-pass").value = "";
    mostrarPantalla('pantalla-login');
}

// Nuevas funciones de registro/edición
function editarPerfilSanitario() {
    obtenerSanitarioRPC(sanitarioActualId, function(sanitario) {
        document.getElementById("reg-nom").value = sanitario.nombre;
        document.getElementById("reg-ape").value = sanitario.apellidos;
        document.getElementById("reg-usu").value = sanitario.usuario;
        document.getElementById("reg-pass").value = ""; 
        mostrarPantalla('pantalla-registro');
    });
}

function guardarSanitario() {
    let datosSan = {
        nombre: document.getElementById("reg-nom").value,
        apellidos: document.getElementById("reg-ape").value,
        usuario: document.getElementById("reg-usu").value,
        password: document.getElementById("reg-pass").value
    };

    if (sanitarioActualId) {
        // Es una edición
        actualizarSanitarioRPC(sanitarioActualId, datosSan, function(exito) {
            if (exito) {
                alert("Datos actualizados correctamente.");
                document.getElementById("bienvenida-nombre").innerText = "Bienvenido/a, " + datosSan.nombre + " " + datosSan.apellidos;
                mostrarPantalla('pantalla-inicio');
            } else {
                alert("Error: El nombre de usuario ya existe o los datos son inválidos.");
            }
        });
    } else {
        // Es un registro nuevo
        crearSanitarioRPC(datosSan, function(idDevuelto) {
            if (idDevuelto !== 0) {
                alert("Sanitario registrado correctamente. Ya puedes iniciar sesión.");
                document.getElementById("reg-nom").value = "";
                document.getElementById("reg-ape").value = "";
                document.getElementById("reg-usu").value = "";
                document.getElementById("reg-pass").value = "";
                mostrarPantalla('pantalla-login');
            } else {
                alert("Error al registrar: El usuario ya existe.");
            }
        });
    }
}

// Referencias para los filtros
const obtenerCategoriasRPC = app.procedure("obtenerCategorias");
const obtenerModelosRPC = app.procedure("obtenerModelos");
const obtenerUbicacionesRPC = app.procedure("obtenerUbicaciones");

// --- BÚSQUEDA Y FILTROS ---
function cargarFiltrosBuscador() {
    // 1. Categorías
    obtenerCategoriasRPC(function(categorias) {
        let opciones = "<option value='Todos'>Todos</option>"; 
        categorias.forEach(c => opciones += `<option value="${c.id}">${c.nombre}</option>`);
        document.getElementById("filtro-cat").innerHTML = opciones;
    });

    // 2. Modelos
    obtenerModelosRPC(function(modelos) {
        let opciones = "<option value='Todos'>Todos</option>";
        modelos.forEach(m => opciones += `<option value="${m.id}">${m.nombre}</option>`);
        document.getElementById("filtro-mod").innerHTML = opciones;
    });

    // 3. Ubicaciones
    obtenerUbicacionesRPC(function(ubicaciones) {
        let opciones = "<option value='Todos'>Todos</option>";
        ubicaciones.forEach(u => opciones += `<option value="${u.id}">${u.nombre}</option>`);
        document.getElementById("filtro-ubi").innerHTML = opciones;
    });
}

function buscarRecursosSanitario() {
    let modId = document.getElementById("filtro-mod").value;
    
    if (modId === "Todos") {
        alert("Por favor, selecciona un Modelo concreto para buscar.");
        return;
    }

    obtenerRecursosRPC(modId, function(recursos) {
        let tbody = document.getElementById("tabla-recursos-sanitario");
        tbody.innerHTML = "";

        if (recursos.length === 0) {
            tbody.innerHTML = "<tr><td colspan='6' class='text-center'>No hay recursos operativos para este modelo.</td></tr>";
            return;
        }

        recursos.forEach(r => {
            obtenerUbicacionesRPC(function(ubicaciones) {
                let ubiObj = ubicaciones.find(u => u.id == r.ubicacion);
                let ubiNombre = ubiObj ? ubiObj.nombre : "Desconocida";
                
                tiempoPendienteRPC(r.id, function(horasPendientes) {
                    let estadoTexto = horasPendientes === 0 ? "Disponible" : `Ocupado (${horasPendientes}h restantes)`;
                    
                    // CLAVE: No leemos del desplegable del buscador, sino que 
                    // buscamos en los datos reales del servidor
                    obtenerModelosRPC(function(modelos) {
                        let modObj = modelos.find(m => m.id == r.modelo);
                        let modNombre = modObj ? modObj.nombre : "Desconocido";

                        obtenerCategoriasRPC(function(categorias) {
                            let catObj = categorias.find(c => c.id == (modObj ? modObj.categoria : null));
                            let catNombre = catObj ? catObj.nombre : "Desconocida";

                            // Aquí usamos r.numero_serie directamente del objeto que viene del servidor
                            tbody.innerHTML += `
                                <tr>
                                    <td data-label="Nº Serie">${r.numero_serie}</td> 
                                    <td data-label="Categoría">${catNombre}</td>
                                    <td data-label="Modelo">${modNombre}</td>
                                    <td data-label="Ubicación">${ubiNombre}</td>
                                    <td data-label="Estado" style="font-weight: bold; color: ${horasPendientes === 0 ? 'green' : 'orange'}">${estadoTexto}</td>
                                    <td data-label="Acciones">
                                        ${horasPendientes === 0 ? 
                                            `<button class="btn-success btn-sm" onclick="accionRetirar(${r.id})">Retirar</button>` : 
                                            `<button class="btn-primary btn-sm" onclick="accionReservar(${r.id})">Reservar</button>`
                                        }
                                    </td>
                                </tr>
                            `;
                        });
                    });
                });
            });
        });
    });
}

// Función cuando el recurso está ocupado y solo lo reservamos para luego
function accionReservar(idRecurso) {
    let horas = document.getElementById("tiempo-uso").value;
    
    reservarRecursoRPC(idRecurso, sanitarioActualId, horas, function(idReserva) {
        if (idReserva) {
            alert("Recurso reservado con éxito. Quedará pendiente hasta que esté disponible.");
            buscarRecursosSanitario(); // Refrescamos la tabla

            if (conexionWS && conexionWS.readyState === WebSocket.OPEN) {
                conexionWS.send(JSON.stringify({
                    operacion: "aviso_nueva_reserva"
                }));
            }
        } else {
            alert("Error al reservar el recurso.");
        }
    });
}

// Función cuando el recurso está libre y nos lo llevamos sobre la marcha
function accionRetirar(idRecurso) {
    let horas = document.getElementById("tiempo-uso").value;
    
    // Primero creamos la reserva...
    reservarRecursoRPC(idRecurso, sanitarioActualId, horas, function(idReserva) {
        if (idReserva) {
            // ... y si se crea bien, la iniciamos instantáneamente
            iniciarReservaRPC(idReserva, function(exito) {
                if (exito) {
                    alert("Has retirado el recurso correctamente.");
                    buscarRecursosSanitario(); // Refrescamos la tabla

                    if (conexionWS && conexionWS.readyState === WebSocket.OPEN) {
                        conexionWS.send(JSON.stringify({
                            operacion: "aviso_nueva_reserva"
                        }));
                    }
                }
            });
        }
    });
}

function abrirNuevaReserva() {
    document.getElementById("tabla-recursos-sanitario").innerHTML = ""; // Vaciamos búsquedas anteriores
    mostrarPantalla('pantalla-nueva-reserva');
}

// --- MIS RESERVAS (PANTALLA INICIO) ---

function cargarMisReservas() {
    obtenerReservasRPC(sanitarioActualId, function(misReservas) {
        let tbodyPendientes = document.getElementById("tabla-reservas-pendientes");
        let tbodyRealizadas = document.getElementById("tabla-reservas-realizadas");
        
        tbodyPendientes.innerHTML = "";
        tbodyRealizadas.innerHTML = "";

        if (misReservas.length === 0) {
            tbodyPendientes.innerHTML = "<tr><td colspan='7' class='text-center'>No tienes reservas pendientes</td></tr>";
            tbodyRealizadas.innerHTML = "<tr><td colspan='7' class='text-center'>No tienes reservas realizadas</td></tr>";
            return;
        }

        misReservas.forEach(reserva => {
            // Obtenemos los datos del recurso asociado a esta reserva
            obtenerRecursoRPC(reserva.recurso, function(recurso) {
                if(!recurso) return;

                // Obtenemos los nombres de Categoría, Modelo y Ubicación
                obtenerModelosRPC(function(modelos) {
                    let modObj = modelos.find(m => m.id == recurso.modelo);
                    obtenerCategoriasRPC(function(categorias) {
                        let catObj = categorias.find(c => c.id == (modObj ? modObj.categoria : null));
                        obtenerUbicacionesRPC(function(ubicaciones) {
                            let ubiObj = ubicaciones.find(u => u.id == recurso.ubicacion);
                            
                            let catNombre = catObj ? catObj.nombre : "Desconocida";
                            let modNombre = modObj ? modObj.nombre : "Desconocido";
                            let ubiNombre = ubiObj ? ubiObj.nombre : "Desconocida";

                            // ¿A qué tabla va?
                            if (reserva.fecha_inicio === null) {
                                // 1. VA A PENDIENTES (Aún no lo has recogido)
                                tiempoPendienteRPC(recurso.id, function(horasRestantes) {
                                    let botones = `<button class="btn-danger btn-sm" onclick="accionCancelar(${reserva.id})">X</button>`;
                                    // Si ya está disponible, te dejamos retirarlo
                                    if (horasRestantes === 0) {
                                        botones = `<button class="btn-success btn-sm" onclick="accionIniciarReserva(${reserva.id}, ${recurso.id}, '${catNombre}', '${modNombre}', '${recurso.numero_serie}')">Retirar</button> ` + botones;
                                    }
                                    

                                    tbodyPendientes.innerHTML += `
                                        <tr>
                                            <td data-label="Categoría">${catNombre}</td>
                                            <td data-label="Modelo">${modNombre}</td>
                                            <td data-label="Nº Serie">${recurso.numero_serie}</td>
                                            <td data-label="Ubicación">${ubiNombre}</td>
                                            <td data-label="Petición">${formatearFecha(reserva.fecha_peticion)}</td>
                                            <td data-label="H. Restantes">${horasRestantes}</td>
                                            <td data-label="Acciones">${botones}</td>
                                        </tr>
                                    `;
                                });
                            } else {
                                // 2. VA A REALIZADAS (Ya te lo llevaste)
                                let botones = "";
                                if (reserva.fecha_fin === null) {
                                    botones = `<button class="btn-primary btn-sm" onclick="accionDevolver(${reserva.id}, ${recurso.id}, '${catNombre}', '${modNombre}', '${recurso.numero_serie}')">Devolver</button>`;
                                } else {
                                    botones = `<button class="btn-secondary btn-sm" onclick="abrirResenya(${recurso.id}, '${catNombre}', '${modNombre}', '${recurso.numero_serie}')">Reseña</button>`;
                                }

                                tbodyRealizadas.innerHTML += `
                                    <tr>
                                        <td data-label="Categoría">${catNombre}</td>
                                        <td data-label="Modelo">${modNombre}</td>
                                        <td data-label="Nº Serie">${recurso.numero_serie}</td>
                                        <td data-label="Horas Estimadas">${reserva.horas_estimadas}</td>
                                        <td data-label="Inicio">${formatearFecha(reserva.fecha_inicio)}</td>
                                        <td data-label="Fin">${formatearFecha(reserva.fecha_fin)}</td>
                                        <td data-label="Acciones">${botones}</td>
                                    </tr>
                                `;
                            }
                        });
                    });
                });
            });
        });
    });
}

function accionCancelar(idReserva) {
    if(confirm("¿Seguro que quieres cancelar esta reserva en cola?")) {
        cancelarReservaRPC(idReserva, function(exito) {
            if(exito) cargarMisReservas(); // Recargamos para que desaparezca
        });
    }
}

function accionIniciarReserva(idReserva, idRecursoAct, catNombre, modNombre, codigo) {
    iniciarReservaRPC(idReserva, function(exito) {
        if(exito) {
            alert("Has recogido el recurso. Pasa a tus reservas realizadas.");
            cargarMisReservas(); 
        }
        if (conexionWS && conexionWS.readyState === WebSocket.OPEN) {
            let frase = `SE HA INICIADO LA RESERVA DEL ${catNombre.toUpperCase()} MODELO ${modNombre.toUpperCase()} CON CÓDIGO ${codigo}.`;
            
            conexionWS.send(JSON.stringify({
                operacion: "aviso_sanitarios_afectados",
                idRecurso: idRecursoAct, 
                origen: "Sistema",
                color: "red", 
                texto: frase
            }));
        }
    });
}

function accionDevolver(idReserva, idRecursoReal, catNombre, modNombre, codigo) {
    finalizarReservaRPC(idReserva, function(exito) {
        if(exito) {
            alert("Recurso devuelto con éxito.");
            
            if (conexionWS && conexionWS.readyState === WebSocket.OPEN) {
                let frase = `SE HA FINALIZADO LA RESERVA DEL ${catNombre.toUpperCase()} MODELO ${modNombre.toUpperCase()} CON CÓDIGO ${codigo}.`;
                
                conexionWS.send(JSON.stringify({
                    operacion: "aviso_sanitarios_afectados",
                    idRecurso: idRecursoReal,
                    origen: "Sistema Central",
                    color: "red",
                    texto: frase
                }));
            }
            cargarMisReservas(); 
        }
    });
}

// Función auxiliar para pintar las fechas bonitas (igual que en el gestor)
function formatearFecha(fechaIso) {
    if (!fechaIso) return "-";
    let fecha = new Date(fechaIso);
    return fecha.toLocaleDateString() + " " + fecha.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

// --- RESEÑAS ---
// Variables para recordar los nombres al mandar el aviso de la reseña
let resenyaCatTemporal = "";
let resenyaModTemporal = "";

function abrirResenya(idRecurso, catNombre, modNombre, codigo) {
    // Nos guardamos los nombres
    resenyaCatTemporal = catNombre;
    resenyaModTemporal = modNombre;

    obtenerRecursoRPC(idRecurso, function(recurso) {
        // Usamos el código que nos llega directo del botón
        document.getElementById("res-serie-txt").innerText = codigo;
        document.getElementById("res-recurso-id").value = idRecurso;
        
        document.getElementById("res-val").value = "5"; 
        document.getElementById("res-desc").value = "";
        
        mostrarPantalla('pantalla-resenya');
    });
}

function enviarResenya() {
    let idRec = document.getElementById("res-recurso-id").value;
    let valoracion = document.getElementById("res-val").value;
    let texto = document.getElementById("res-desc").value;
    let codigo = document.getElementById("res-serie-txt").innerText; // Pillamos el código visual

    crearResenyaRPC(idRec, sanitarioActualId, valoracion, texto, function(idResenya) {
        if (idResenya) {
            if (conexionWS && conexionWS.readyState === WebSocket.OPEN) {
                // Frase exacta en verde
                let frase = `SE HA CREADO UNA RESEÑA PARA EL ${resenyaCatTemporal.toUpperCase()} MODELO ${resenyaModTemporal.toUpperCase()} CON CÓDIGO ${codigo} Y PUNTUACIÓN ${valoracion}.`;

                conexionWS.send(JSON.stringify({
                    operacion: "aviso_gestores",
                    origen: "Sanitario ID: " + sanitarioActualId,
                    color: "green",
                    texto: frase
                }));
            }
            alert("¡Reseña guardada correctamente! Gracias por tu valoración.");
            mostrarPantalla('pantalla-inicio');
        } else {
            alert("Error al guardar la reseña.");
        }
    });
}

// --- WEBSOCKETS (SANITARIO) ---
function conectarWebSocketsSanitario() {
    conexionWS = new WebSocket("ws://localhost:4444", "hospital");

    conexionWS.addEventListener("open", function () {
        console.log("Sanitario conectado al servidor de WebSockets");
        
        // Nos identificamos como SANITARIO
        conexionWS.send(JSON.stringify({
            operacion: "identificar",
            tipo: "sanitario",
            idUsuario: sanitarioActualId
        }));
    });

    conexionWS.addEventListener("message", function (evento) {
        let msg = JSON.parse(evento.data);
        let tbody = document.getElementById("tabla-avisos");
        if (tbody.innerHTML.includes("No hay avisos")) tbody.innerHTML = ""; // Limpiar si es el primero
        
        let hora = new Date().toLocaleTimeString();
        // Insertamos la fila al principio de la tabla con el color correspondiente
        tbody.innerHTML = `
            <tr style="background-color: #f9f9f9;">
                <td>${hora}</td>
                <td>${msg.origen}</td>
                <td style="color: ${msg.color}; font-weight: bold;">${msg.texto}</td>
            </tr>
        ` + tbody.innerHTML;
    });
}

// ==========================================
// CÓDIGO NFC - PRÁCTICA 2
// ==========================================
document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() { 
    nfc.addNdefListener(
        function (nfcEvent) {
            var tag = nfcEvent.tag;
            var payload = tag.ndefMessage[0].payload;
            var languageCodeLength = payload[0] & 0x3F;
            var text = nfc.bytesToString(payload.slice(1 + languageCodeLength));
            
            alert("Contenido de la etiqueta: " + text);

            obtenerRecursoPorCodigoRPC(text, function(recurso) {
                if (!recurso) return alert("El código leído no pertenece a ningún recurso registrado.");
                
                obtenerReservasRPC(sanitarioActualId, function(reservas) {
                    let reservaEnUso = reservas.find(r => r.recurso === recurso.id && r.fecha_inicio !== null && r.fecha_fin === null);
                    let reservaPendiente = reservas.find(r => r.recurso === recurso.id && r.fecha_inicio === null);

                    if (reservaEnUso) {
                        finalizarReservaRPC(reservaEnUso.id, function(exito) {
                            if(exito) { alert("Recurso devuelto correctamente"); cargarMisReservas(); }
                        });
                    } else if (reservaPendiente) {
                        iniciarReservaRPC(reservaPendiente.id, function(exito) {
                            if(exito) { alert("Recurso retirado correctamente"); cargarMisReservas(); }
                        });
                    } else {
                        reservarRecursoRPC(recurso.id, sanitarioActualId, 24, function(idNuevaReserva) { 
                            if (idNuevaReserva) {
                                iniciarReservaRPC(idNuevaReserva, function(exito) {
                                    if(exito) { alert("Reserva creada sobre la marcha y recurso retirado"); cargarMisReservas(); }
                                });
                            }
                        });
                    }
                });
            });
        },
        function () { console.log("Escuchador NFC activado con éxito."); },
        function (error) { console.log("Error al iniciar el escuchador NFC: " + error); }
    );
}

function escribirNFC(texto) {
    var record = ndef.textRecord(texto);
    nfc.write( 
        [record], 
        function () { alert("¡Escritura en NFC exitosa!"); },
        function (error) { alert("Error al escribir: " + JSON.stringify(error)); }
    );
}