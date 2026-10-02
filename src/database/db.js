const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const driver = (process.env.DB_DRIVER || 'sqlite').toLowerCase();
let sqlite;
let pool;
let sqliteQueue = Promise.resolve();

function serializeSqlite(operation) {
    const task = sqliteQueue.then(operation);
    sqliteQueue = task.then(() => undefined, () => undefined);
    return task;
}

function sqliteAdapter(connection) {
    return {
        all(sql, params = []) {
            return connection.prepare(sql).all(...params);
        },
        get(sql, params = []) {
            return connection.prepare(sql).get(...params);
        },
        run(sql, params = []) {
            const result = connection.prepare(sql).run(...params);
            return { insertId: result.lastInsertRowid, changes: result.changes };
        },
        async lockTherapist() {}
    };
}

function mysqlAdapter(connection) {
    return {
        async all(sql, params = []) {
            const [rows] = await connection.execute(sql, params);
            return rows;
        },
        async get(sql, params = []) {
            const [rows] = await connection.execute(sql, params);
            return rows[0];
        },
        async run(sql, params = []) {
            const [result] = await connection.execute(sql, params);
            return { insertId: result.insertId, changes: result.affectedRows };
        },
        async lockTherapist(id) {
            await connection.execute('SELECT id_pessoa FROM TERAPEUTA WHERE id_pessoa = ? FOR UPDATE', [id]);
        }
    };
}

const mysqlSchema = [
    `CREATE TABLE IF NOT EXISTS PESSOA (
        id_pessoa INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(160) NOT NULL,
        cpf VARCHAR(14) NOT NULL UNIQUE,
        senha VARCHAR(100) NOT NULL,
        telefone VARCHAR(30) NOT NULL
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS TERAPEUTA (
        id_pessoa INT PRIMARY KEY,
        especialidade VARCHAR(120) NOT NULL,
        FOREIGN KEY (id_pessoa) REFERENCES PESSOA(id_pessoa) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS PACIENTE (
        id_pessoa INT PRIMARY KEY,
        nome_responsavel VARCHAR(160) NOT NULL DEFAULT '',
        FOREIGN KEY (id_pessoa) REFERENCES PESSOA(id_pessoa) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS AGENDAMENTO (
        id_agendamento INT AUTO_INCREMENT PRIMARY KEY,
        data_agendamento DATE NOT NULL,
        hora_agendamento TIME NOT NULL,
        status ENUM('Agendado', 'Confirmado', 'Realizado', 'Cancelado') NOT NULL DEFAULT 'Agendado',
        id_terapeuta INT NOT NULL,
        id_paciente INT NOT NULL,
        FOREIGN KEY (id_terapeuta) REFERENCES TERAPEUTA(id_pessoa),
        FOREIGN KEY (id_paciente) REFERENCES PACIENTE(id_pessoa),
        INDEX idx_agendamento_data (data_agendamento),
        INDEX idx_agendamento_terapeuta_data (id_terapeuta, data_agendamento)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS PRONTUARIO (
        id_prontuario INT AUTO_INCREMENT PRIMARY KEY,
        data_registro DATE NOT NULL,
        descricao TEXT NOT NULL,
        id_paciente INT NOT NULL,
        id_terapeuta INT NOT NULL,
        FOREIGN KEY (id_paciente) REFERENCES PACIENTE(id_pessoa),
        FOREIGN KEY (id_terapeuta) REFERENCES TERAPEUTA(id_pessoa),
        INDEX idx_prontuario_paciente_data (id_paciente, data_registro)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS MENSAGEM (
        id_mensagem INT AUTO_INCREMENT PRIMARY KEY,
        conteudo TEXT NOT NULL,
        data_envio DATETIME NOT NULL,
        id_terapeuta INT NOT NULL,
        id_paciente INT NOT NULL,
        FOREIGN KEY (id_terapeuta) REFERENCES TERAPEUTA(id_pessoa),
        FOREIGN KEY (id_paciente) REFERENCES PACIENTE(id_pessoa)
    ) ENGINE=InnoDB`
];

async function withTransaction(callback) {
    if (driver === 'sqlite') {
        return serializeSqlite(async () => {
            sqlite.exec('BEGIN IMMEDIATE');
            try {
                const result = await callback(sqliteAdapter(sqlite));
                sqlite.exec('COMMIT');
                return result;
            } catch (error) {
                sqlite.exec('ROLLBACK');
                throw error;
            }
        });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await callback(mysqlAdapter(connection));
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function seed() {
    const database = driver === 'sqlite' ? sqliteAdapter(sqlite) : mysqlAdapter(pool);
    const count = await database.get('SELECT COUNT(*) AS total FROM PESSOA');
    if (Number(count.total) > 0) return;

    const senha = await bcrypt.hash('123456', 10);
    const today = new Date();
    const dateOffset = (offset) => {
        const date = new Date(today);
        date.setDate(date.getDate() + offset);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    const appointments = [
        [dateOffset(0), '09:00:00', 1, 3],
        [dateOffset(0), '14:00:00', 2, 4],
        [dateOffset(1), '10:00:00', 1, 5]
    ];

    await withTransaction(async (tx) => {
        const people = [
            ['Ana Paula Terapeuta', '11111111111', '11999990001'],
            ['Bruno Lima Terapeuta', '22222222222', '11999990002'],
            ['Mariana Costa', '00000000001', '11999990101'],
            ['Pedro Henrique', '00000000002', '11999990102'],
            ['Julia Santos', '00000000003', '11999990103'],
            ['Lucas Almeida', '00000000004', '11999990104'],
            ['Beatriz Oliveira', '00000000005', '11999990105']
        ];
        for (const [nome, cpf, telefone] of people) {
            await tx.run(
                'INSERT INTO PESSOA (nome, cpf, senha, telefone) VALUES (?, ?, ?, ?)',
                [nome, cpf, senha, telefone]
            );
        }
        await tx.run('INSERT INTO TERAPEUTA (id_pessoa, especialidade) VALUES (?, ?)', [1, 'Terapia ocupacional']);
        await tx.run('INSERT INTO TERAPEUTA (id_pessoa, especialidade) VALUES (?, ?)', [2, 'Integração sensorial']);
        const responsaveis = ['Carla Costa', 'Roberto Henrique', 'Fernanda Santos', 'Paula Almeida', 'Renato Oliveira'];
        for (let index = 0; index < responsaveis.length; index += 1) {
            await tx.run(
                'INSERT INTO PACIENTE (id_pessoa, nome_responsavel) VALUES (?, ?)',
                [index + 3, responsaveis[index]]
            );
        }
        for (const appointment of appointments) {
            await tx.run(
                'INSERT INTO AGENDAMENTO (data_agendamento, hora_agendamento, id_terapeuta, id_paciente) VALUES (?, ?, ?, ?)',
                appointment
            );
        }
    });
}

async function initialize() {
    if (driver === 'sqlite') {
        const Database = require('better-sqlite3');
        const filename = path.resolve(process.env.DB_PATH || path.join(__dirname, 'sgt-to.sqlite'));
        fs.mkdirSync(path.dirname(filename), { recursive: true });
        sqlite = new Database(filename);
        sqlite.pragma('foreign_keys = ON');
        const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        sqlite.exec(schema);
    } else if (driver === 'mysql') {
        const mysql = require('mysql2/promise');
        pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'sgt_to',
            waitForConnections: true,
            connectionLimit: 10,
            dateStrings: true
        });
        for (const statement of mysqlSchema) await pool.execute(statement);
    } else {
        throw new Error(`DB_DRIVER inválido: ${driver}. Use sqlite ou mysql.`);
    }

    await seed();
}

const database = {
    initialize,
    all(sql, params = []) {
        return driver === 'sqlite'
            ? serializeSqlite(() => sqliteAdapter(sqlite).all(sql, params))
            : mysqlAdapter(pool).all(sql, params);
    },
    get(sql, params = []) {
        return driver === 'sqlite'
            ? serializeSqlite(() => sqliteAdapter(sqlite).get(sql, params))
            : mysqlAdapter(pool).get(sql, params);
    },
    run(sql, params = []) {
        return driver === 'sqlite'
            ? serializeSqlite(() => sqliteAdapter(sqlite).run(sql, params))
            : mysqlAdapter(pool).run(sql, params);
    },
    transaction: withTransaction
};

module.exports = database;
