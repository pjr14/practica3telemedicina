// servidor_rest.js
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const CLAVE_SECRETA = "telemedicina2026"; // firma del portero


const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://krjzvrutqgjrlsxhzekm.supabase.co'; 
const supabaseKey = 'sb_publishable_1PHEK7yuqADYb1kYOqBcOw_S7KvV_yv'; 
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuración para permitir CORS (Cross-Origin Resource Sharing) desde el frontend
app.use(express.static("public_rest")); // apuntamos a la carpeta con el frontend
app.use("/sanitario", express.static("public_rpc")); // Para que el sanitario pueda acceder a la parte RPC desde su propia URL. De la parte 2 del proyecto.
app.use(express.json()); // Para poder leer el body en formato JSON


function verificarToken(req, res, next) {
    if (req.path === '/gestores/login' || (req.path === '/gestores' && req.method === 'POST')) {
        return next();
    }
    const cabeceraAuth = req.headers['authorization'];
    if (!cabeceraAuth) return res.status(401).json("Acceso denegado. Falta el token.");

    const token = cabeceraAuth.split(' ')[1];
    jwt.verify(token, CLAVE_SECRETA, function(err, datosDescodificados) {
        if (err) return res.status(403).json("Token inválido o caducado.");
        req.gestorAutenticado = datosDescodificados;
        next(); 
    });
}

// Activamos la seguridad para la API
app.use('/api', verificarToken);

// ==========================================
// endpoints traducidos a supabase
// ==========================================

// Obtiene un array con todas las ubicaciones
app.get("/api/ubicaciones", async (req, res) => {
    let { data, error } = await supabase.from('ubicaciones').select('*');
    if (error) return res.status(500).json("Error BD");
    res.status(200).json(data);
});

// Obtiene un array con todas las categorías
app.get("/api/categorias", async (req, res) => {
    let { data, error } = await supabase.from('categorias').select('*');
    if (error) return res.status(500).json("Error BD");
    res.status(200).json(data);
});

// Obtiene un array con todos los modelos
app.get("/api/modelos", async (req, res) => {
    let { data, error } = await supabase.from('modelos').select('*');
    if (error) return res.status(500).json("Error BD");
    res.status(200).json(data);
});

// ==========================================
// RECURSOS: Búsqueda e Inventario
// ==========================================

// Obtener recursos filtrados
app.get("/api/recursos", async (req, res) => {
    let query = supabase.from('recursos').select(`
        id, numero_serie, estado, modelo, ubicacion,
        modelos ( nombre, categoria ),
        ubicaciones ( nombre )
    `);
    
    if (req.query.modelo && req.query.modelo !== "Todos") query = query.eq('modelo', req.query.modelo);
    if (req.query.ubicacion && req.query.ubicacion !== "Todos") query = query.eq('ubicacion', req.query.ubicacion);
    if (req.query.estado && req.query.estado !== "Todos") query = query.eq('estado', req.query.estado);

    let { data, error } = await query;
    if (error) return res.status(500).json("Error BD");

    if (req.query.categoria && req.query.categoria !== "Todos") {
        data = data.filter(r => r.modelos && r.modelos.categoria == req.query.categoria);
    }

    let { data: categorias } = await supabase.from('categorias').select('*');
    
    let filas = data.map(r => {
        let catNombre = categorias.find(c => c.id === r.modelos.categoria)?.nombre;
        return {
            id: r.id,
            numero_serie: r.numero_serie,
            categoria_nombre: catNombre,
            modelo_nombre: r.modelos.nombre,
            ubicacion_nombre: r.ubicaciones.nombre,
            estado: r.estado
        };
    });

    res.status(200).json(filas);
});

// Borrar un recurso
app.delete("/api/recursos/:id", async (req, res) => {
    let { error, count } = await supabase.from('recursos').delete({ count: 'exact' }).eq('id', req.params.id);
    if (error) return res.status(500).json("Error al borrar el recurso");
    if (count === 0) return res.status(404).json("No se ha encontrado el recurso");
    res.status(200).json("Recurso borrado");
});


// ==========================================
// GESTORES: Login, Registro y Perfil
// ==========================================

// Login del gestor (MODIFICADO CON JWT)
app.post("/api/gestores/login", async (req, res) => {
    let { data, error } = await supabase.from('gestores').select('id')
        .eq('usuario', req.body.login)
        .eq('password', req.body.password);
    
    if (error){
        return res.status(500).json("Error BD");
    } 
    if (data.length > 0) {
        let idGestor = data[0].id;
        // Creamos el Token JWT aquí
        let tokenVIP = jwt.sign({ id: idGestor }, CLAVE_SECRETA, { expiresIn: '1h' });
        res.status(200).json({ id: idGestor, token: tokenVIP });
    } else {
        res.status(403).json("Credenciales incorrectas");
    }
});

// Registro de un nuevo gestor
app.post("/api/gestores", async (req, res) => {
    let nuevoGestor = req.body;
    let { data: existe } = await supabase.from('gestores').select('id').eq('usuario', nuevoGestor.usuario);
    if (existe && existe.length > 0) return res.status(400).json("El usuario ya existe");

    let { error } = await supabase.from('gestores').insert([{
        nombre: nuevoGestor.nombre, apellidos: nuevoGestor.apellidos, 
        usuario: nuevoGestor.usuario, password: nuevoGestor.password
    }]);
    if (error) return res.status(500).json("Error al crear gestor");
    res.status(201).json("Gestor creado");
});

// Obtener los datos de un gestor
app.get("/api/gestores/:id", async (req, res) => {
    let { data, error } = await supabase.from('gestores').select('id, nombre, apellidos, usuario').eq('id', req.params.id);
    if (error) return res.status(500).json("Error BD");
    if (data.length > 0) res.status(200).json(data[0]);
    else res.status(404).json("Gestor no encontrado");
});

// Actualizar datos de un gestor
app.put("/api/gestores/:id", async (req, res) => {
    let { data: existe } = await supabase.from('gestores').select('id')
        .eq('usuario', req.body.usuario).neq('id', req.params.id);
    if (existe && existe.length > 0) return res.status(400).json("Usuario en uso");

    let { error } = await supabase.from('gestores').update({
        nombre: req.body.nombre, apellidos: req.body.apellidos, usuario: req.body.usuario
    }).eq('id', req.params.id);
    if (error) return res.status(500).json("Error al actualizar");
    res.status(200).json("Gestor actualizado");
});

// ==========================================
// GESTIÓN INDIVIDUAL DE RECURSOS (Ficha)
// ==========================================

// Obtener los datos de un solo recurso
app.get("/api/recursos/:id", async (req, res) => {
    let { data, error } = await supabase.from('recursos').select('*').eq('id', req.params.id);
    if (error) return res.status(500).json("Error BD");
    if (data.length > 0) res.status(200).json(data[0]);
    else res.status(404).json("Recurso no encontrado");
});

// Crear un nuevo recurso
app.post("/api/recursos", async (req, res) => {
    let n = req.body;
    let { data, error } = await supabase.from('recursos').insert([{
        modelo: n.modelo, ubicacion: n.ubicacion, numero_serie: n.numero_serie, estado: n.estado
    }]).select();
    if (error) return res.status(500).json("Error al crear");
    n.id = data[0].id;
    res.status(201).json(n);
});

// Actualizar un recurso
app.put("/api/recursos/:id", async (req, res) => {
    let n = req.body;
    let { error } = await supabase.from('recursos').update({
        modelo: n.modelo, ubicacion: n.ubicacion, numero_serie: n.numero_serie, estado: n.estado
    }).eq('id', req.params.id);
    if (error) return res.status(500).json("Error al actualizar");
    res.status(200).json("Recurso actualizado");
});

// Obtener las reservas de un recurso
app.get("/api/recursos/:id/reservas", async (req, res) => {
    let { data, error } = await supabase.from('reservas').select('*, sanitarios(nombre, apellidos)').eq('recurso', req.params.id);
    if (error) return res.status(500).json("Error BD");
    let filas = data.map(r => ({ ...r, sanitario_nombre: `${r.sanitarios.nombre} ${r.sanitarios.apellidos}` }));
    res.status(200).json(filas);
});

// Obtener las reseñas de un recurso
app.get("/api/recursos/:id/resenyas", async (req, res) => {
    let { data, error } = await supabase.from('resenyas').select('*, sanitarios(nombre, apellidos)').eq('recurso', req.params.id);
    if (error) return res.status(500).json("Error BD");
    let filas = data.map(r => ({ ...r, sanitario_nombre: `${r.sanitarios.nombre} ${r.sanitarios.apellidos}` }));
    res.status(200).json(filas);
});

// Obtiene un objeto con los datos de un sanitario (seguro, sin contraseña)
app.get("/api/sanitarios/:id", async (req, res) => {
    let { data, error } = await supabase.from('sanitarios').select('id, nombre, apellidos, usuario').eq('id', req.params.id);
    if (error) return res.status(500).json("Error BD");
    if (data.length > 0) res.status(200).json(data[0]);
    else res.status(404).json("Sanitario no encontrado");
});



// Arrancamos el servidor en el puerto 3000
app.listen(3000, () => {
    console.log("Servidor REST del gestor escuchando en puerto 3000 (Supabase + JWT)");
});

