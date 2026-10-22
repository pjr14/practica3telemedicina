// public_rest/app_rest.js

let gestorActualId = null; 
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

    rest.post("/api/gestores/login", { login: usu, password: pass }, function(estado, respuesta) {
        if (estado === 200) {
            gestorActualId = respuesta.id; // sacamos el ID del gestor logueado
            window.miToken = respuesta.token; // guardamos el token en una variable global para usarlo en futuras peticiones
            
            rest.get("/api/gestores/" + gestorActualId, function(est, gestor) { // Obtenemos los datos del gestor para mostrar su nombre en la pantalla de inicio
                if (est === 200) {
                    document.getElementById("bienvenida-nombre").innerText = gestor.nombre + " " + gestor.apellidos;
                    mostrarPantalla('pantalla-inicio');
                    cargarFiltrosBuscador(); 

                    conectarWebSocketsGestor(); // Conectamos a WebSockets al hacer login exitoso
                }
            });
        } else {
            alert("Usuario o contraseña incorrectos");
        }
    });
}

function cerrarSesion() {
    gestorActualId = null;
    document.getElementById("login-usu").value = "";
    document.getElementById("login-pass").value = "";
    mostrarPantalla('pantalla-login');
}

function guardarGestor() {
    let nuevoGestor = {
        nombre: document.getElementById("reg-nom").value,
        apellidos: document.getElementById("reg-ape").value,
        usuario: document.getElementById("reg-usu").value, 
        password: document.getElementById("reg-pass").value
    };

    // Si ya estamos logueados, es una edición (PUT), si no, es un registro (POST)
    if (gestorActualId) {
        rest.put("/api/gestores/" + gestorActualId, nuevoGestor, function(estado, respuesta) {
            if (estado === 200) {
                alert("Datos actualizados correctamente.");
                document.getElementById("bienvenida-nombre").innerText = nuevoGestor.nombre + " " + nuevoGestor.apellidos;
                mostrarPantalla('pantalla-inicio');
            } else {
                alert("Error al actualizar: " + respuesta);
            }
        });
    } else {
        rest.post("/api/gestores", nuevoGestor, function(estado, respuesta) {
            if (estado === 201) {
                alert("Gestor registrado. Ya puedes iniciar sesión.");
                mostrarPantalla('pantalla-login');
            } else {
                alert("Error al registrar: " + respuesta);
            }
        });
    }
}

// Para que el botón "Editar Mis Datos" funcione
function editarPerfil() {
    rest.get("/api/gestores/" + gestorActualId, function(est, gestor) {
        if (est === 200) {
            document.getElementById("titulo-registro").innerText = "Editar Mis Datos";
            document.getElementById("reg-nom").value = gestor.nombre;
            document.getElementById("reg-ape").value = gestor.apellidos;
            document.getElementById("reg-usu").value = gestor.usuario;
            // Ojo: el servidor no nos devuelve la contraseña por seguridad, habría que pedirla o dejarla en blanco
            document.getElementById("reg-pass").value = ""; 
            mostrarPantalla('pantalla-registro');
        }
    });
}

// --- BÚSQUEDA Y FILTROS ---
function cargarFiltrosBuscador() {
    rest.get("/api/categorias", function(estado, categorias) {
        if (estado === 200) {
            let opcionesBuscador = "<option value='Todos'>Todos</option>"; 
            let opcionesFicha = ""; // Para crear recurso no queremos la opción "Todos"
            categorias.forEach(c => {
                opcionesBuscador += `<option value="${c.id}">${c.nombre}</option>`;
                opcionesFicha += `<option value="${c.id}">${c.nombre}</option>`;
            });
            document.getElementById("filtro-cat").innerHTML = opcionesBuscador;
            document.getElementById("rec-cat").innerHTML = opcionesFicha; 
        }
    });

    rest.get("/api/modelos", function(estado, modelos) {
        if (estado === 200) {
            let opcionesBuscador = "<option value='Todos'>Todos</option>";
            modelos.forEach(m => opcionesBuscador += `<option value="${m.id}">${m.nombre}</option>`);
            document.getElementById("filtro-mod").innerHTML = opcionesBuscador;
            // OJO: No rellenamos rec-mod aquí, lo haremos con la nueva función dependiente
        }
    });

    rest.get("/api/ubicaciones", function(estado, ubicaciones) {
        if (estado === 200) {
            let opcionesBuscador = "<option value='Todos'>Todos</option>";
            let opcionesFicha = "";
            ubicaciones.forEach(u => {
                opcionesBuscador += `<option value="${u.id}">${u.nombre}</option>`;
                opcionesFicha += `<option value="${u.id}">${u.nombre}</option>`;
            });
            document.getElementById("filtro-ubi").innerHTML = opcionesBuscador;
            document.getElementById("rec-ubi").innerHTML = opcionesFicha; 
        }
    });
}

function buscarRecursos() {
    let cat = document.getElementById("filtro-cat").value;
    let mod = document.getElementById("filtro-mod").value;
    let ubi = document.getElementById("filtro-ubi").value;
    let est = document.getElementById("filtro-est").value;

    let url = `/api/recursos?categoria=${cat}&modelo=${mod}&ubicacion=${ubi}&estado=${est}`;

    rest.get(url, function(estado, recursos) {
        if (estado === 200) {
            let tbody = document.getElementById("tabla-recursos");
            tbody.innerHTML = ""; 

            if (recursos.length === 0) {
                tbody.innerHTML = "<tr><td colspan='6' class='text-center'>No se encontraron recursos</td></tr>";
                return;
            }

            recursos.forEach(r => {
                let textoEstado = r.estado == 0 ? "Operativo" : (r.estado == 1 ? "De baja / Defectuoso" : "En mantenimiento");

                tbody.innerHTML += `
                    <tr>
                        <td>${r.numero_serie}</td>
                        <td>${r.categoria_nombre}</td>
                        <td>${r.modelo_nombre}</td>
                        <td>${r.ubicacion_nombre}</td>
                        <td>${textoEstado}</td>
                        <td>
                            <button class="btn-primary btn-sm" onclick="abrirFichaRecurso(${r.id})">Abrir</button>                            
                            <button class="btn-danger btn-sm" onclick="borrarRecurso(${r.id})">X</button>
                        </td>
                    </tr>
                `;
            });
        }
    });
}

function borrarRecurso(idRecurso) {
    // 1. Lanzamos la pregunta al usuario. 
    // confirm() devuelve 'true' si pulsa Aceptar, y 'false' si pulsa Cancelar.
    let seguro = confirm("¿Seguro que quiere eliminar este recurso? Esta acción no se puede deshacer.");

    // 2. Solo hacemos la petición al servidor si ha dicho que sí
    if (seguro) {
        rest.delete("/api/recursos/" + idRecurso, function (estado, respuesta) {
            if (estado == 200) {
                // 3. Avisamos por WebSocket si se ha borrado correctamente
                if (conexionWS && conexionWS.readyState === WebSocket.OPEN) {
                    conexionWS.send(JSON.stringify({
                        operacion: "aviso_sanitarios_afectados",
                        idRecurso: idRecurso,
                        origen: "Gestor",
                        color: "red",
                        texto: `ATENCIÓN: El recurso que tienes reservado ha sido ELIMINADO.`
                    }));
                }
                
                // 4. Refrescamos la tabla
                buscarRecursos(); 
            } else {
                alert("No se ha podido borrar el recurso");
            }
        });
    }
}

// --- FICHA DE RECURSO ---

function nuevoRecurso() {
    document.getElementById("rec-id").value = "";
    document.getElementById("rec-serie").value = "";
    document.getElementById("rec-cat").selectedIndex = 0; 
    document.getElementById("rec-ubi").selectedIndex = 0;
    document.getElementById("rec-est").value = "0";

    document.getElementById("tabla-reservas-recurso").innerHTML = "<tr><td colspan='5' class='text-center'>Sin reservas (Recurso nuevo)</td></tr>";
    document.getElementById("tabla-resenyas-recurso").innerHTML = "<tr><td colspan='4' class='text-center'>Sin reseñas (Recurso nuevo)</td></tr>";

    // Llamamos a nuestra función para que pinte los modelos de la 1ª categoría de la lista
    actualizarModelosFicha(); 

    mostrarPantalla('pantalla-recurso');
}

function abrirFichaRecurso(id) {
    rest.get("/api/recursos/" + id, function(est, recurso) {
        if (est === 200) {
            document.getElementById("rec-id").value = recurso.id;
            document.getElementById("rec-serie").value = recurso.numero_serie;
            document.getElementById("rec-ubi").value = recurso.ubicacion;
            document.getElementById("rec-est").value = recurso.estado;

            // Al abrir, buscamos qué categoría tiene este modelo
            rest.get("/api/modelos", function(estMod, modelos) {
                if (estMod === 200) {
                    let modObj = modelos.find(m => m.id == recurso.modelo);
                    if (modObj) {
                        document.getElementById("rec-cat").value = modObj.categoria;
                        // Cargamos los modelos de ESA categoría y dejamos marcado el suyo
                        actualizarModelosFicha(recurso.modelo); 
                    }
                }
            });

            mostrarPantalla('pantalla-recurso');
        }
    });

    // 2. Cargar tabla de Reservas
    rest.get("/api/recursos/" + id + "/reservas", function(est, reservas) {
        let tbody = document.getElementById("tabla-reservas-recurso");
        tbody.innerHTML = "";
        if (reservas.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' class='text-center'>No hay reservas</td></tr>";
        } else {
            // ... (dentro de abrirFichaRecurso) ...
            reservas.forEach(r => {
                // LÓGICA DE COLORES
                let claseColor = "";

                if (r.fecha_fin) {
                    // 1. Si tiene fecha_fin, ya está finalizada (Blanca)
                    claseColor = "reserva-blanca"; 
                } else if (!r.fecha_inicio) {
                    // 2. Si no tiene fecha_inicio, está pendiente (Verde)
                    claseColor = "reserva-verde"; 
                } else {
                    // 3. Si tiene inicio pero no fin, está en uso. Hay que calcular el tiempo.
                    let inicio = new Date(r.fecha_inicio);
                    let ahora = new Date();
                    // Calculamos la diferencia en milisegundos y lo pasamos a horas
                    let horasTranscurridas = (ahora - inicio) / (1000 * 60 * 60);

                    if (horasTranscurridas <= r.horas_estimadas) {
                        claseColor = "reserva-azul"; // En tiempo
                    } else {
                        claseColor = "reserva-roja"; // Tiempo excedido
                    }
                }

                // Pintamos la fila añadiéndole la clase CSS que hemos calculado
                tbody.innerHTML += `
                    <tr class="${claseColor}">
                        <td>${r.sanitario_nombre}</td>
                        <td>${r.horas_estimadas}</td>
                        <td>${formatearFecha(r.fecha_peticion)}</td>
                        <td>${formatearFecha(r.fecha_inicio)}</td>
                        <td>${formatearFecha(r.fecha_fin)}</td>
                    </tr>
                `;
            });
        }
    });

    // 3. Cargar tabla de Reseñas
    rest.get("/api/recursos/" + id + "/resenyas", function(est, resenyas) {
        let tbody = document.getElementById("tabla-resenyas-recurso");
        tbody.innerHTML = "";
        
        if (resenyas.length === 0) {
            tbody.innerHTML = "<tr><td colspan='4' class='text-center'>No hay reseñas</td></tr>";
        } else {
            resenyas.forEach(r => {
                tbody.innerHTML += `
                    <tr>
                        <td>${formatearFecha(r.fecha)}</td>
                        <td>${r.sanitario_nombre}</td>
                        <td style="color: #f1c40f; font-size: 1.2em;">${generarEstrellas(r.valor)}</td>
                        <td>${r.descripcion}</td>
                    </tr>
                `;
            });
        }
    });
}

function guardarRecurso() {
    let idGuardado = document.getElementById("rec-id").value;
    
    let datosRecurso = {
        numero_serie: document.getElementById("rec-serie").value,
        modelo: document.getElementById("rec-mod").value,
        ubicacion: document.getElementById("rec-ubi").value,
        estado: document.getElementById("rec-est").value
    };

    // Si tiene ID, actualizamos (PUT). Si no tiene, creamos (POST)
    if (idGuardado !== "") {
        rest.put("/api/recursos/" + idGuardado, datosRecurso, function(estado, respuesta) {
            if (estado === 200) {
                alert("Recurso actualizado con éxito");
                
                // --- AVISO WEBSOCKET  ---
                try {
                    if (conexionWS && conexionWS.readyState === WebSocket.OPEN) {
                        conexionWS.send(JSON.stringify({
                            operacion: "aviso_sanitarios_afectados",
                            idRecurso: idGuardado,
                            origen: "Gestor Hospitalario",
                            color: "red",
                            texto: `ATENCIÓN: Un recurso que tienes reservado (ID ${idGuardado}) ha sido modificado. Revisa su estado.`
                        }));
                    }
                } catch (e) {
                    console.error("Fallo al enviar WebSocket de actualización", e);
                }
                
                buscarRecursos();
                mostrarPantalla('pantalla-inicio');
            } else alert("Error al actualizar");
        });
    } else {
        rest.post("/api/recursos", datosRecurso, function(estado, respuesta) {
            if (estado === 201) {
                
                // --- AVISO WEBSOCKET ---
                try {
                    if (conexionWS && conexionWS.readyState === WebSocket.OPEN) {
                        let selectCat = document.getElementById("rec-cat");
                        // Comprobamos que existan opciones antes de leerlas para evitar errores
                        let catNombre = selectCat.options[selectCat.selectedIndex] ? selectCat.options[selectCat.selectedIndex].text : "CATEGORÍA";
                        
                        let selectMod = document.getElementById("rec-mod");
                        let modNombre = selectMod.options[selectMod.selectedIndex] ? selectMod.options[selectMod.selectedIndex].text : "MODELO";
                        
                        let codigo = datosRecurso.numero_serie;

                        let frase = `SE HA CREADO UN NUEVO RECURSO ${catNombre.toUpperCase()} MODELO ${modNombre.toUpperCase()} CON CÓDIGO ${codigo}.`;

                        conexionWS.send(JSON.stringify({
                            operacion: "aviso_todos_sanitarios",
                            origen: "Gestor: " + document.getElementById("bienvenida-nombre").innerText,
                            color: "blue",
                            texto: frase
                        }));
                    }
                } catch (error) {
                    // Si el WebSocket falla, lo pintamos en consola pero NO bloqueamos la pantalla
                    console.error("Error al enviar el aviso por WebSocket: ", error);
                }

                // Estas líneas ahora se ejecutarán SIEMPRE, haya fallado el WebSocket o no
                alert("Recurso creado con éxito");
                buscarRecursos(); // Refrescamos la tabla
                mostrarPantalla('pantalla-inicio');

            } else {
                alert("Error al crear");
            }
        });
    }
}
// Función auxiliar para pintar las fechas bonitas (evitar que salga 'null')
function formatearFecha(fechaIso) {
    if (!fechaIso) return "-";
    let fecha = new Date(fechaIso);
    return fecha.toLocaleDateString() + " " + fecha.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

// Nueva función para enlazar modelos a su categoría
function actualizarModelosFicha(modeloParaSeleccionar = null) {
    let catId = document.getElementById("rec-cat").value;
    
    rest.get("/api/modelos", function(estado, modelos) {
        if (estado === 200) {
            let opciones = "";
            // Filtramos el array para quedarnos SOLO con los de la categoría seleccionada
            let modelosFiltrados = modelos.filter(m => m.categoria == catId);
            
            modelosFiltrados.forEach(m => {
                opciones += `<option value="${m.id}">${m.nombre}</option>`;
            });
            
            document.getElementById("rec-mod").innerHTML = opciones;

            // Si estamos abriendo una ficha ya existente, le decimos qué modelo debe dejar marcado
            if (modeloParaSeleccionar) {
                document.getElementById("rec-mod").value = modeloParaSeleccionar;
            }
        }
    });
}

function generarEstrellas(valor) {
    let estrellas = "";
    for (let i = 1; i <= 5; i++) {
        if (i <= valor) {
            estrellas += "⭐"; // Estrella llena
        } else {
            estrellas += "☆"; // Estrella vacía
        }
    }
    return estrellas;
}


// --- WEBSOCKETS (GESTOR) ---
function conectarWebSocketsGestor() {
    // 1. Nos conectamos al puerto 4444 (¡Ojo! Protocolo 'hospital')
    conexionWS = new WebSocket("wss://practica3telemedicina-cz8e.onrender.com", "hospital");

    conexionWS.addEventListener("open", function () {
        console.log("Gestor conectado al servidor de WebSockets");
        
        // 2. Nos identificamos como GESTOR
        conexionWS.send(JSON.stringify({
            operacion: "identificar",
            tipo: "gestor",
            idUsuario: gestorActualId
        }));
    });

    // 3. Cuando recibimos un mensaje (aviso) del servidor
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

    conexionWS.addEventListener("close", function () {
        console.log("Conexión WebSocket cerrada.");
    });
}

// practica 3: enviar datos al ministerio.
// Diccionario para traducir el número de área (1 al 18) a su nombre real
const AREAS_MEDICAS = {
    1: "Alergología", 2: "Anestesiología", 3: "Cardiología", 4: "Cirugía General", 
    5: "Dermatología", 6: "Aparato Digestivo", 7: "Endocrinología", 8: "Ginecología", 
    9: "Hematología", 10: "Medicina Interna", 11: "Neumología", 12: "Neurología", 
    13: "Oftalmología", 14: "Oncología", 15: "Pediatría", 16: "Psiquiatría", 
    17: "Traumatología", 18: "Urología"
};

function obtenerRankingMinisterio() {
    let urlMinisterio = "https://undefined.ua.es/telemedicina/api/datos";
    
    // Hacemos la petición GET al servidor del Gobierno
    rest.get(urlMinisterio, function(estado, respuesta) {
        if (estado !== 200) {
            alert("Error al conectar con el Ministerio de Sanidad.");
            return;
        }

        // 1. Agrupar y contar las reservas por área
        let contadorAreas = {};

        respuesta.forEach(envio => {
            let id = envio.id_area;
            
            // Si el área no está en nuestro contador, la creamos empezando en 0
            if (!contadorAreas[id]) {
                contadorAreas[id] = 0;
            }
            
            // Sumamos la cantidad de reservas de este envío (el tamaño del array 'datos')
            if (envio.datos && Array.isArray(envio.datos)) {
                contadorAreas[id] += envio.datos.length;
            }
        });

        // 2. Convertir nuestro contador a un array para poder ordenarlo
        let ranking = [];
        for (let id in contadorAreas) {
            ranking.push({
                nombre: AREAS_MEDICAS[id] || ("Área Desconocida " + id),
                reservas: contadorAreas[id]
            });
        }

        // 3. Ordenar de mayor a menor número de reservas
        ranking.sort((a, b) => b.reservas - a.reservas);

        // 4. Pintar la tabla
        let tbody = document.getElementById("tabla-ranking-ministerio");
        tbody.innerHTML = "";

        if (ranking.length === 0) {
            tbody.innerHTML = "<tr><td colspan='3' class='text-center'>No hay datos en el Ministerio</td></tr>";
            return;
        }

        let posicion = 1;
        ranking.forEach(item => {
            tbody.innerHTML += `
                <tr>
                    <td class="text-center" style="font-weight: bold; color: #7f8c8d;">${posicion}º</td>
                    <td>${item.nombre}</td>
                    <td class="text-center" style="font-weight: bold; color: #2c3e50;">${item.reservas}</td>
                </tr>
            `;
            posicion++;
        });
    });
}

function enviarDatosMinisterio() {
    // 1. Usamos el GET que ya tenemos para sacar todos los recursos
    rest.get("/api/recursos", function(estado, recursos) {
        if (estado !== 200) return alert("Error al obtener recursos");
        if (recursos.length === 0) return alert("No hay recursos en la base de datos.");

        let todasLasReservas = [];
        let peticionesCompletadas = 0;

        // Por cada recurso, GET que ya tenemos para sacar sus reservas
        recursos.forEach(recurso => {
            rest.get("/api/recursos/" + recurso.id + "/reservas", function(est, reservasRecurso) {
                if (est === 200) {
                    reservasRecurso.forEach(r => {
                        // Separamos el nombre del sanitario (que nos llega como "Nombre Apellido")
                        let partesNombre = r.sanitario_nombre ? r.sanitario_nombre.split(' ') : ["Desconocido", ""];
                        let nombre = partesNombre[0];
                        let apellidos = partesNombre.slice(1).join(' ');

                        // Juntamos los datos de ambas peticiones (del recurso y de la reserva)
                        todasLasReservas.push({
                            nombre: nombre,
                            apellidos: apellidos,
                            categoría: recurso.categoria_nombre, // Lo sacamos del primer GET
                            horas_estimadas: r.horas_estimadas,
                            fec_pet: r.fecha_peticion,
                            fec_ini: r.fecha_inicio,
                            fecha_fin: r.fecha_fin
                        });
                    });
                }

                peticionesCompletadas++;

                // terminamos de revisar TODOS los recursos, enviamos el POST
                if (peticionesCompletadas === recursos.length) {
                    if (todasLasReservas.length === 0) {
                        return alert("No hay reservas en tu base de datos para enviar. ¡Crea una primero!");
                    }

                    // Preparamos el paquete con el id 15 (Pediatría)
                    let paquete = {
                        id_area: 15, 
                        fecha: new Date().toISOString().split('T')[0], // Formato YYYY-MM-DD
                        datos: todasLasReservas
                    };

                    let urlMinisterio = "https://undefined.ua.es/telemedicina/api/datos";
                    
                    rest.post(urlMinisterio, paquete, function(estadoMin, respuesta) {
                        if (estadoMin === 200 || estadoMin === 201) {
                            alert("¡Datos enviados al Ministerio con éxito usando múltiples GETs!");
                            obtenerRankingMinisterio();
                        } else {
                            alert("Error del servidor del Ministerio (Código " + estadoMin + ")");
                        }
                    });
                }
            });
        });
    });
}

function contarReservas() {
    let idArea = parseInt(document.getElementById("input-area-examen").value);
    
    if (isNaN(idArea)) {
        alert("Introduce un ID de área válido.");
        return;
    }

    rest.get("https://undefined.ua.es/telemedicina/api/datos", function(estado, respuesta) {
        if (estado === 200) {
            let totalReservas = 0;
            
            respuesta.forEach(envio => {
                if (envio.id_area === idArea && envio.datos) {
                    totalReservas += envio.datos.length;
                }
            });

            let nombreArea = AREAS_MEDICAS[idArea] || "Desconocida";
            alert("Existen " + totalReservas + " reservas del área de " + nombreArea);
        }
    });
}

function calcularPorcentajeFinalizadas() {
    
}

