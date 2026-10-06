const fs = require('node:fs');
const path = require('node:path');

const driver = (process.env.DB_DRIVER || 'sqlite').toLowerCase();
const PASTA_SQL = path.join(__dirname, '..', '..', 'database');
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

// Bancos criados antes do módulo de mensagens não têm a coluna "remetente".
async function migrate() {
    if (driver === 'sqlite') {
        const colunas = sqlite.prepare('PRAGMA table_info(MENSAGEM)').all();
        if (!colunas.some((coluna) => coluna.name === 'remetente')) {
            sqlite.exec(`ALTER TABLE MENSAGEM ADD COLUMN remetente TEXT NOT NULL DEFAULT 'paciente'
                CHECK (remetente IN ('terapeuta', 'paciente'))`);
        }
        return;
    }
    const [colunas] = await pool.execute(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MENSAGEM' AND COLUMN_NAME = 'remetente'`
    );
    if (!colunas.length) {
        await pool.execute(
            "ALTER TABLE MENSAGEM ADD COLUMN remetente ENUM('terapeuta', 'paciente') NOT NULL DEFAULT 'paciente'"
        );
    }
}

// Lê um arquivo da pasta database/ e separa os comandos pelo ";" do fim da linha.
function lerScript(nome) {
    return fs.readFileSync(path.join(PASTA_SQL, nome), 'utf8')
        .split(/\r?\n/)
        .filter((linha) => !linha.trim().startsWith('--'))
        .join('\n')
        .split(/;\s*(?:\n|$)/)
        .map((comando) => comando.trim())
        .filter(Boolean);
}

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

    const today = new Date();
    const dateOffset = (offset) => {
        const date = new Date(today);
        date.setDate(date.getDate() + offset);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    const appointments = [
        [dateOffset(0), '09:00:00', 1, 3],
        [dateOffset(1), '10:00:00', 1, 5],
        [dateOffset(0), '14:00:00', 2, 4],
        [dateOffset(1), '11:30:00', 2, 6],
        [dateOffset(2), '15:30:00', 2, 7]
    ];

    // Pessoas, terapeutas e pacientes vêm do script SQL. Os agendamentos são criados aqui
    // com datas relativas ao dia de hoje, para a agenda sempre ter consultas na semana atual.
    await withTransaction(async (tx) => {
        for (const comando of lerScript('dados-exemplo.sql')) await tx.run(comando);
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
        sqlite.exec(lerScript('schema.sql').join(';\n'));
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
        for (const comando of lerScript('schema-mysql.sql')) await pool.execute(comando);
    } else {
        throw new Error(`DB_DRIVER inválido: ${driver}. Use sqlite ou mysql.`);
    }

    await migrate();
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
