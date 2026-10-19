// server_rpc.js

const rpc = require("./rpc.js"); 
const { createClient } = require('@supabase/supabase-js');

// 1. Inicializar Supabase (CÓDIGO DEL VÍDEO)
const supabaseUrl = 'https://krjzvrutqgjrlsxhzekm.supabase.co'; 
const supabaseKey = 'sb_publishable_1PHEK7yuqADYb1kYOqBcOw_S7KvV_yv'; 
const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Creamos el servidor RPC
const servidor = rpc.server(3501, function() {
    console.log("Servidor RPC del sanitario escuchando en el puerto 3501 (Supabase)");
});

const appRpc = servidor.createApp("app_sanitario");

// ===============
// rpc a supabase
// ===============

async function obtenerCategorias(callback) {
    let { data, error } = await supabase.from('categorias').select('*');
    if (error) return callback([]);
    return callback(data);
}

async function obtenerModelos(callback) {
    let { data, error } = await supabase.from('modelos').select('*');
    if (error) return callback([]);
    return callback(data);
}

async function obtenerUbicaciones(callback) {
    let { data, error } = await supabase.from('ubicaciones').select('*');
    if (error) return callback([]);
    return callback(data);
}

async function loginSanitario(usuario, password, callback) {
    let { data, error } = await supabase.from('sanitarios').select('id')
        .eq('usuario', usuario).eq('password', password);
    if (error || data.length === 0) return callback(null);
    return callback(data[0].id);
}

async function obtenerSanitario(id, callback) {
    let { data, error } = await supabase.from('sanitarios').select('id, nombre, apellidos, usuario').eq('id', id);
    if (error || data.length === 0) return callback(null);
    return callback(data[0]);
}


async function crearSanitario(sanitarioNuevo, callback) {
    let { data: existe } = await supabase.from('sanitarios').select('id').eq('usuario', sanitarioNuevo.usuario);
    if (existe && existe.length > 0) return callback(0); 

    let { data, error } = await supabase.from('sanitarios').insert([{
        nombre: sanitarioNuevo.nombre, 
        apellidos: sanitarioNuevo.apellidos, 
        usuario: sanitarioNuevo.usuario, 
        password: sanitarioNuevo.password
    }]).select('id');
    
    if (error || !data) return callback(0); 
    return callback(data[0].id);
}

async function actualizarSanitario(idSanitario, datosSanitario, callback) {
    let { data: existe } = await supabase.from('sanitarios').select('id')
        .eq('usuario', datosSanitario.usuario).neq('id', idSanitario);
    if (existe && existe.length > 0) return callback(false);

    let actualizacion = {
        nombre: datosSanitario.nombre, 
        apellidos: datosSanitario.apellidos, 
        usuario: datosSanitario.usuario
    };
    if (datosSanitario.password) actualizacion.password = datosSanitario.password;

    let { error } = await supabase.from('sanitarios').update(actualizacion).eq('id', idSanitario);
    if (error) return callback(false);
    return callback(true);
}

async function obtenerRecursos(idModelo, callback) {
    let { data, error } = await supabase.from('recursos').select('*').eq('modelo', idModelo).eq('estado', 0);
    if (error) return callback([]);
    return callback(data);
}

async function tiempoPendiente(idRecurso, callback) {
    let { data, error } = await supabase.from('reservas')
        .select('fecha_inicio, horas_estimadas')
        .eq('recurso', idRecurso)
        .not('fecha_inicio', 'is', null)
        .is('fecha_fin', null);
    
    if (error || data.length === 0) return callback(0);

    let reservaActiva = data[0];
    let inicio = new Date(reservaActiva.fecha_inicio);
    let ahora = new Date();
    let horasEnUso = (ahora - inicio) / (1000 * 60 * 60);
    let horasRestantes = reservaActiva.horas_estimadas - horasEnUso;
    
    if (horasRestantes < 0) return callback(0); 
    return callback(Math.round(horasRestantes * 10) / 10);
}

async function reservarRecurso(idRecurso, idSanitario, horasEstimadas, callback) {
    let { data, error } = await supabase.from('reservas').insert([{
        recurso: idRecurso, 
        sanitario: idSanitario, 
        horas_estimadas: parseFloat(horasEstimadas), 
        fecha_peticion: new Date().toISOString()
    }]).select('id');
    
    if (error || !data) return callback(null);
    return callback(data[0].id); 
}

async function iniciarReserva(idReserva, callback) {
    let { error } = await supabase.from('reservas').update({
        fecha_inicio: new Date().toISOString()
    }).eq('id', idReserva);
    if (error) return callback(false);
    return callback(true);
}

async function obtenerReservas(idSanitario, callback) {
    let { data, error } = await supabase.from('reservas').select('*').eq('sanitario', idSanitario);
    if (error) return callback([]);
    return callback(data);
}

async function cancelarReserva(idReserva, callback) {
    let { error } = await supabase.from('reservas').delete().eq('id', idReserva);
    if (error) return callback(false);
    return callback(true);
}

async function finalizarReserva(idReserva, callback) {
    let { error } = await supabase.from('reservas').update({
        fecha_fin: new Date().toISOString()
    }).eq('id', idReserva);
    if (error) return callback(false);
    return callback(true);
}

async function obtenerRecurso(idRecurso, callback) {
    let { data, error } = await supabase.from('recursos').select('*').eq('id', idRecurso);
    if (error || data.length === 0) return callback(null);
    return callback(data[0]);
}

async function crearResenya(idRecurso, idSanitario, valoracion, descripcion, callback) {
    let { data, error } = await supabase.from('resenyas').insert([{
        recurso: idRecurso, 
        sanitario: idSanitario, 
        fecha: new Date().toISOString(), 
        valor: parseInt(valoracion), 
        descripcion: descripcion
    }]).select('id');
    
    if (error || !data) return callback(null);
    return callback(data[0].id); 
}

async function obtenerResenyas(idRecurso, callback) {
    let { data, error } = await supabase.from('resenyas').select('*').eq('recurso', idRecurso);
    if (error) return callback([]);
    return callback(data);
}

async function obtenerRecursoPorCodigo(codigo, callback) {
    let { data, error } = await supabase.from('recursos').select('*').eq('numero_serie', codigo);
    if (error || data.length === 0) return callback(null);
    return callback(data[0]);
}

// 3. Registramos los procedimientos
appRpc.registerAsync(obtenerCategorias);
appRpc.registerAsync(obtenerModelos);
appRpc.registerAsync(obtenerUbicaciones);
appRpc.registerAsync(loginSanitario);
appRpc.registerAsync(obtenerSanitario);
appRpc.registerAsync(crearSanitario);
appRpc.registerAsync(actualizarSanitario);
appRpc.registerAsync(obtenerRecursos);
appRpc.registerAsync(tiempoPendiente);
appRpc.registerAsync(reservarRecurso);
appRpc.registerAsync(iniciarReserva);
appRpc.registerAsync(obtenerReservas);
appRpc.registerAsync(cancelarReserva);
appRpc.registerAsync(finalizarReserva);
appRpc.registerAsync(obtenerRecurso);
appRpc.registerAsync(crearResenya);
appRpc.registerAsync(obtenerResenyas);
appRpc.registerAsync(obtenerRecursoPorCodigo);