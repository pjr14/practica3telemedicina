// server_ws.js
const http = require("http");
const WebSocketServer = require("websocket").server;
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://krjzvrutqgjrlsxhzekm.supabase.co'; 
const supabaseKey = 'sb_publishable_1PHEK7yuqADYb1kYOqBcOw_S7KvV_yv'; 
const supabase = createClient(supabaseUrl, supabaseKey);

const httpServer = http.createServer();
httpServer.listen(4444, function () {
    console.log("Servidor de WebSockets escuchando en el puerto 4444 (Supabase)");
});

const wsServer = new WebSocketServer({ httpServer: httpServer });
let clientes = []; 

wsServer.on("request", function (request) {
    const connection = request.accept("hospital", request.origin);
    const cliente = { connection: connection, tipo: null, idUsuario: null };
    clientes.push(cliente);

    connection.on("message", async function (message) {
        if (message.type === "utf8") {
            let msg = JSON.parse(message.utf8Data);

            if (msg.operacion === "identificar") {
                cliente.tipo = msg.tipo;
                cliente.idUsuario = msg.idUsuario;
            }
            
            // 1. AVISO VERDE (Reseñas) -> Para todos los gestores
            else if (msg.operacion === "aviso_gestores") {
                clientes.forEach(c => {
                    if (c.tipo === "gestor") c.connection.sendUTF(JSON.stringify(msg));
                });
            }
            
            // 2. AVISO AZUL (Recurso Nuevo) -> Para todos los sanitarios
            else if (msg.operacion === "aviso_todos_sanitarios") {
                clientes.forEach(c => {
                    if (c.tipo === "sanitario") c.connection.sendUTF(JSON.stringify(msg));
                });
            }
            
            // 3. AVISO ROJO (Reserva Inicia/Finaliza) -> Para sanitarios afectados
            else if (msg.operacion === "aviso_sanitarios_afectados") {
                
                // Le pedimos a Supabase los IDs de los sanitarios que tienen este recurso sin finalizar
                let { data, error } = await supabase.from('reservas').select('sanitario')
                    .eq('recurso', msg.idRecurso).is('fecha_fin', null);
                
                if (error || !data) return; // Si hay fallo en BD, simplemente no mandamos el aviso
                
                // Extraemos los IDs de las filas devueltas por Supabase
                let sanitariosAfectados = data.map(r => r.sanitario);

                // Enviamos el mensaje a los clientes conectados que estén en la lista
                clientes.forEach(c => {
                    if (c.tipo === "sanitario" && sanitariosAfectados.includes(c.idUsuario) && c.idUsuario !== cliente.idUsuario) {
                        c.connection.sendUTF(JSON.stringify(msg));
                    }
                });
            }
        }
    });

    connection.on("close", function () {
        clientes = clientes.filter(c => c.connection !== connection);
    });
});