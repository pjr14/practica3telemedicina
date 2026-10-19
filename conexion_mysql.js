const mysql = require('mysql');
const database = {
    host : 'localhost',
    user : 'telemed_2026a',
    password : '2026Telemedicina',
    database : 'telemed_patri'
};

const conexion = mysql.createConnection(database);

conexion.connect(function (err) {
    if (err) {
        console.error('Error en la conexión de la base de datos:',err);
        process.exit();
    }
});

module.exports = conexion;