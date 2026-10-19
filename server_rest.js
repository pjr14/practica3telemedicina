// servidor_rest.js
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const CLAVE_SECRETA = "telemedicina2026"; // Esta es la "firma" del portero

// Configuración para permitir CORS (Cross-Origin Resource Sharing) desde el frontend
app.use(express.static("public_rest")); // apuntamos a la carpeta con el frontend
app.use("/sanitario", express.static("public_rpc")); // Para que el sanitario pueda acceder a la parte RPC desde su propia URL. De la parte 2 del proyecto.
app.use(express.json()); // Para poder leer el body en formato JSON

// Importamos los datos en memoria
const conexion = require('./conexion_mysql.js');

// ==========================================
// ENDPOINTS BÁSICOS (Solo lectura)
// ==========================================

// Obtiene un array con todas las ubicaciones
app.get("/api/ubicaciones", function (req, res) {
    conexion.query("SELECT * FROM ubicaciones", function(err, filas) {
        if (err) return res.status(500).json("Error BD");
        res.status(200).json(filas);
    });
});

// Obtiene un array con todas las categorías
app.get("/api/categorias", function (req, res) {
    conexion.query("SELECT * FROM categorias", function(err, filas) {
        if (err) return res.status(500).json("Error BD");
        res.status(200).json(filas);
    });
});

// Obtiene un array con todos los modelos
app.get("/api/modelos", function (req, res) {
    conexion.query("SELECT * FROM modelos", function(err, filas) {
        if (err) return res.status(500).json("Error BD");
        res.status(200).json(filas);
    });
});

// ==========================================
// RECURSOS: Búsqueda e Inventario
// ==========================================

// Obtener recursos filtrados
app.get("/api/recursos", function (req, res) {
    // 1. Consulta base cruzando las tablas (JOIN) para obtener nombres en vez de IDs numéricos
    let sql = `
        SELECT 
            r.id, 
            r.numero_serie, 
            c.nombre AS categoria_nombre, 
            m.nombre AS modelo_nombre, 
            u.nombre AS ubicacion_nombre, 
            r.estado
        FROM recursos r
        LEFT JOIN modelos m ON r.modelo = m.id
        LEFT JOIN categorias c ON m.categoria = c.id
        LEFT JOIN ubicaciones u ON r.ubicacion = u.id
        WHERE 1=1
    `;
    let variables = []; // Aquí guardaremos los valores de los filtros

    // 2. Añadimos los filtros SQL si el usuario no ha elegido "Todos"
    if (req.query.modelo && req.query.modelo !== "Todos") {
        sql += " AND r.modelo = ?";
        variables.push(req.query.modelo);
    }
    if (req.query.ubicacion && req.query.ubicacion !== "Todos") {
        sql += " AND r.ubicacion = ?";
        variables.push(req.query.ubicacion);
    }
    if (req.query.estado && req.query.estado !== "Todos") {
        sql += " AND r.estado = ?";
        variables.push(req.query.estado);
    }
    if (req.query.categoria && req.query.categoria !== "Todos") {
        sql += " AND m.categoria = ?";
        variables.push(req.query.categoria);
    }

    // 3. Ejecutamos la consulta pasándole las variables de forma segura
    conexion.query(sql, variables, function(err, filas) {
        if (err) {
            console.error("Error al buscar recursos:", err);
            return res.status(500).json("Error en la base de datos");
        }
        // Devolvemos el array JSON con la misma estructura que antes
        res.status(200).json(filas);
    });
});

// Borrar un recurso
app.delete("/api/recursos/:id", function (req, res) {
    let id = req.params.id;
    
    // El símbolo '?' se sustituye por el [id] de forma segura
    conexion.query("DELETE FROM recursos WHERE id = ?", [id], function(err, resultado) {
        if (err) return res.status(500).json("Error al borrar el recurso");
        
        // affectedRows nos dice cuántas filas se han borrado. Si es 0, el ID no existía.
        if (resultado.affectedRows === 0) {
            return res.status(404).json("No se ha encontrado el recurso a borrar");
        }
        
        res.status(200).json("Recurso borrado");
    });
});


// ==========================================
// GESTORES: Login, Registro y Perfil
// ==========================================

// Login del gestor (MODIFICADO CON JWT)
app.post("/api/gestores/login", function (req, res) {
    let loginReq = req.body.login; 
    let passReq = req.body.password;

    conexion.query("SELECT id FROM gestores WHERE usuario = ? AND password = ?", [loginReq, passReq], function(err, filas) {
        if (err) return res.status(500).json("Error BD");
        
        if (filas.length > 0) {
            let idGestor = filas[0].id;
            
            // token de 1 hora
            let tokenVIP = jwt.sign({ id: idGestor }, CLAVE_SECRETA, { expiresIn: '1h' });
            
            // envío a la aplicación junto con el ID
            res.status(200).json({ id: idGestor, token: tokenVIP });
        } else {
            res.status(403).json("Credenciales incorrectas");
        }
    });
});

// Registro de un nuevo gestor
app.post("/api/gestores", function (req, res) {
    let nuevoGestor = req.body;
    
    // 1. Comprobamos si el usuario ya existe
    conexion.query("SELECT id FROM gestores WHERE usuario = ?", [nuevoGestor.usuario], function(err, filas) {
        if (err) return res.status(500).json("Error BD");
        
        if (filas.length > 0) {
            return res.status(400).json("El usuario ya existe en el sistema");
        }

        // 2. Si no existe, lo insertamos
        let sql = "INSERT INTO gestores (nombre, apellidos, usuario, password) VALUES (?, ?, ?, ?)";
        conexion.query(sql, [nuevoGestor.nombre, nuevoGestor.apellidos, nuevoGestor.usuario, nuevoGestor.password], function(err, resultado) {
            if (err) return res.status(500).json("Error al crear el gestor");
            res.status(201).json("Gestor creado");
        });
    });
});

// Obtener los datos de un gestor
app.get("/api/gestores/:id", function (req, res) {
    let idBuscar = req.params.id;
    
    conexion.query("SELECT id, nombre, apellidos, usuario FROM gestores WHERE id = ?", [idBuscar], function(err, filas) {
        if (err) return res.status(500).json("Error BD");
        
        if (filas.length > 0) {
            res.status(200).json(filas[0]);
        } else {
            res.status(404).json("Gestor no encontrado");
        }
    });
});


// Actualizar datos de un gestor
app.put("/api/gestores/:id", function (req, res) {
    let id = req.params.id;
    let datosNuevos = req.body;

    // 1. Comprobamos si el nuevo login ya lo tiene otro gestor (que no sea él mismo)
    conexion.query("SELECT id FROM gestores WHERE usuario = ? AND id != ?", [datosNuevos.usuario, id], function(err, filas) {
        if (err) return res.status(500).json("Error BD");
        
        if (filas.length > 0) {
            return res.status(400).json("Ese nombre de usuario ya está en uso");
        }

        // 2. Actualizamos los datos
        let sql = "UPDATE gestores SET nombre = ?, apellidos = ?, usuario = ? WHERE id = ?";
        conexion.query(sql, [datosNuevos.nombre, datosNuevos.apellidos, datosNuevos.usuario, id], function(err, resultado) {
            if (err) return res.status(500).json("Error al actualizar");
            res.status(200).json("Gestor actualizado");
        });
    });
});

// ==========================================
// GESTIÓN INDIVIDUAL DE RECURSOS (Ficha)
// ==========================================

// Obtener los datos de un solo recurso
app.get("/api/recursos/:id", function (req, res) {
    conexion.query("SELECT * FROM recursos WHERE id = ?", [req.params.id], function(err, filas) {
        if (err) return res.status(500).json("Error BD");
        if (filas.length > 0) res.status(200).json(filas[0]);
        else res.status(404).json("Recurso no encontrado");
    });
});

// Crear un nuevo recurso
app.post("/api/recursos", function (req, res) {
    let n = req.body;
    let sql = "INSERT INTO recursos (modelo, ubicacion, numero_serie, estado) VALUES (?, ?, ?, ?)";
    
    conexion.query(sql, [n.modelo, n.ubicacion, n.numero_serie, n.estado], function(err, result) {
        if (err) return res.status(500).json("Error al crear");
        
        n.id = result.insertId; // IMPORTANTE: MySQL nos da el ID autogenerado
        res.status(201).json(n); 
    });
});

// Actualizar un recurso
app.put("/api/recursos/:id", function (req, res) {
    let n = req.body;
    let sql = "UPDATE recursos SET modelo = ?, ubicacion = ?, numero_serie = ?, estado = ? WHERE id = ?";
    
    conexion.query(sql, [n.modelo, n.ubicacion, n.numero_serie, n.estado, req.params.id], function(err, result) {
        if (err) return res.status(500).json("Error al actualizar");
        if (result.affectedRows === 0) return res.status(404).json("Recurso no encontrado");
        res.status(200).json("Recurso actualizado");
    });
});

// Obtener las reservas de un recurso
app.get("/api/recursos/:id/reservas", function (req, res) {
    let sql = `
        SELECT r.*, CONCAT(s.nombre, ' ', s.apellidos) AS sanitario_nombre 
        FROM reservas r 
        LEFT JOIN sanitarios s ON r.sanitario = s.id 
        WHERE r.recurso = ?
    `;
    conexion.query(sql, [req.params.id], function(err, filas) {
        if (err) return res.status(500).json("Error BD");
        res.status(200).json(filas);
    });
});

// Obtener las reseñas de un recurso
app.get("/api/recursos/:id/resenyas", function (req, res) {
    let sql = `
        SELECT r.*, CONCAT(s.nombre, ' ', s.apellidos) AS sanitario_nombre 
        FROM resenyas r 
        LEFT JOIN sanitarios s ON r.sanitario = s.id 
        WHERE r.recurso = ?
    `;
    conexion.query(sql, [req.params.id], function(err, filas) {
        if (err) return res.status(500).json("Error BD");
        res.status(200).json(filas);
    });
});

// Obtiene un objeto con los datos de un sanitario (seguro, sin contraseña)
app.get("/api/sanitarios/:id", function (req, res) {
    conexion.query("SELECT id, nombre, apellidos, usuario FROM sanitarios WHERE id = ?", [req.params.id], function(err, filas) {
        if (err) return res.status(500).json("Error BD");
        if (filas.length > 0) res.status(200).json(filas[0]);
        else res.status(404).json("Sanitario no encontrado");
    });
});



// practica 3. Ranking Ministerio de Sanidad
app.get("/api/reservas_ministerio", function (req, res) {
    // Cruzamos las tablas para obtener los nombres reales en lugar de los IDs numéricos
    let sql = `
        SELECT 
            s.nombre, 
            s.apellidos, 
            c.nombre AS categoría, 
            r.horas_estimadas, 
            r.fecha_peticion AS fec_pet, 
            r.fecha_inicio AS fec_ini, 
            r.fecha_fin 
        FROM reservas r
        JOIN sanitarios s ON r.sanitario = s.id
        JOIN recursos rec ON r.recurso = rec.id
        JOIN modelos m ON rec.modelo = m.id
        JOIN categorias c ON m.categoria = c.id
    `;
    conexion.query(sql, function(err, filas) {
        if (err) return res.status(500).json("Error BD");
        res.status(200).json(filas);
    });
});



// Arrancamos el servidor en el puerto 3000
app.listen(3000, () => {
    console.log("Servidor REST del gestor escuchando en http://localhost:3000");
});

