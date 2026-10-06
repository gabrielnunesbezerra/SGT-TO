const express = require('express');
const db = require('../database/db');
const { exigirTerapeuta } = require('../middleware/auth');

const router = express.Router();
const statusValidos = ['Agendado', 'Confirmado', 'Realizado', 'Cancelado'];

// Expediente do consultório: o último atendimento precisa terminar até o fechamento.
const ABERTURA = '08:00';
const FECHAMENTO = '18:00';
const DURACAO_MIN = 50;

function emMinutos(hora) {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
}

function emHora(minutos) {
    return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

const ULTIMO_INICIO = emHora(emMinutos(FECHAMENTO) - DURACAO_MIN);

// Procura outro atendimento ativo que se sobreponha aos 50 minutos da sessão,
// seja do mesmo terapeuta ou do mesmo paciente.
async function buscarConflito(conexao, { data, hora, idTerapeuta, idPaciente }) {
    const inicio = emMinutos(hora);
    const choque = await conexao.get(
        `SELECT id_terapeuta FROM AGENDAMENTO
         WHERE data_agendamento = ? AND status <> 'Cancelado'
           AND hora_agendamento > ? AND hora_agendamento < ?
           AND (id_terapeuta = ? OR id_paciente = ?)`,
        [data, `${emHora(inicio - DURACAO_MIN)}:00`, `${emHora(inicio + DURACAO_MIN)}:00`, idTerapeuta, idPaciente]
    );
    if (!choque) return null;
    return Number(choque.id_terapeuta) === Number(idTerapeuta)
        ? 'O terapeuta já tem um atendimento que ocupa esse horário.'
        : 'O paciente já tem um atendimento que ocupa esse horário.';
}

function dataLocal(date) {
    const dois = (valor) => String(valor).padStart(2, '0');
    return `${date.getFullYear()}-${dois(date.getMonth() + 1)}-${dois(date.getDate())}`;
}

router.get('/terapeutas', exigirTerapeuta, async (req, res) => {
    const terapeutas = await db.all(
        `SELECT p.id_pessoa, p.nome, t.especialidade
         FROM TERAPEUTA t JOIN PESSOA p ON p.id_pessoa = t.id_pessoa
         ORDER BY p.nome`
    );
    res.json(terapeutas);
});

router.get('/', async (req, res) => {
    const { inicio, fim, id_terapeuta, id_paciente } = req.query;
    const filtros = [];
    const params = [];
    if (inicio) {
        filtros.push('a.data_agendamento >= ?');
        params.push(inicio);
    }
    if (fim) {
        filtros.push('a.data_agendamento <= ?');
        params.push(fim);
    }
    if (id_terapeuta) {
        filtros.push('a.id_terapeuta = ?');
        params.push(Number(id_terapeuta));
    }
    if (req.usuario.tipo === 'paciente') {
        filtros.push('a.id_paciente = ?');
        params.push(req.usuario.id);
    } else if (id_paciente) {
        filtros.push('a.id_paciente = ?');
        params.push(Number(id_paciente));
    }
    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const agendamentos = await db.all(
        `SELECT a.id_agendamento, a.data_agendamento, a.hora_agendamento, a.status,
                a.id_terapeuta, t.nome AS nome_terapeuta,
                a.id_paciente, p.nome AS nome_paciente
         FROM AGENDAMENTO a
         JOIN PESSOA t ON t.id_pessoa = a.id_terapeuta
         JOIN PESSOA p ON p.id_pessoa = a.id_paciente
         ${where}
         ORDER BY a.data_agendamento, a.hora_agendamento`,
        params
    );
    res.json(agendamentos);
});

router.post('/', exigirTerapeuta, async (req, res) => {
    const data = typeof req.body.data_agendamento === 'string' ? req.body.data_agendamento : '';
    const hora = typeof req.body.hora_agendamento === 'string' ? req.body.hora_agendamento : '';
    const idPaciente = Number(req.body.id_paciente);
    const idTerapeuta = Number(req.body.id_terapeuta);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hora)
        || !Number.isSafeInteger(idPaciente) || idPaciente < 1
        || !Number.isSafeInteger(idTerapeuta) || idTerapeuta < 1) {
        return res.status(400).json({ erro: 'Informe paciente, terapeuta, data e horário válidos.' });
    }
    if (new Date(`${data}T00:00:00Z`).toISOString().slice(0, 10) !== data) {
        return res.status(400).json({ erro: 'A data informada não é válida.' });
    }
    const agora = new Date();
    const hoje = dataLocal(agora);
    const horaAtual = agora.toTimeString().slice(0, 5);
    if (data < hoje || (data === hoje && hora <= horaAtual)) {
        return res.status(400).json({ erro: 'Não é possível agendar em uma data ou horário que já passou.' });
    }
    if (hora < ABERTURA || hora > ULTIMO_INICIO) {
        return res.status(400).json({
            erro: `O consultório atende das ${ABERTURA} às ${FECHAMENTO}. O último horário de início é ${ULTIMO_INICIO}.`
        });
    }
    const diaSemana = new Date(`${data}T12:00:00Z`).getUTCDay();
    if (diaSemana === 0 || diaSemana === 6) {
        return res.status(400).json({ erro: 'O consultório atende de segunda a sexta.' });
    }

    const terapeuta = await db.get('SELECT id_pessoa FROM TERAPEUTA WHERE id_pessoa = ?', [idTerapeuta]);
    const paciente = await db.get('SELECT id_pessoa FROM PACIENTE WHERE id_pessoa = ?', [idPaciente]);
    if (!terapeuta || !paciente) {
        return res.status(400).json({ erro: 'Paciente ou terapeuta não encontrado.' });
    }
    const horaCompleta = `${hora}:00`;
    try {
        const agendamento = await db.transaction(async (tx) => {
            await tx.lockTherapist(idTerapeuta);
            const conflito = await buscarConflito(tx, { data, hora, idTerapeuta, idPaciente });
            if (conflito) {
                const error = new Error(conflito);
                error.status = 409;
                throw error;
            }
            const result = await tx.run(
                `INSERT INTO AGENDAMENTO (data_agendamento, hora_agendamento, status, id_terapeuta, id_paciente)
                 VALUES (?, ?, 'Agendado', ?, ?)`,
                [data, horaCompleta, idTerapeuta, idPaciente]
            );
            return tx.get(
                `SELECT a.id_agendamento, a.data_agendamento, a.hora_agendamento, a.status,
                        a.id_terapeuta, t.nome AS nome_terapeuta,
                        a.id_paciente, p.nome AS nome_paciente
                 FROM AGENDAMENTO a
                 JOIN PESSOA t ON t.id_pessoa = a.id_terapeuta
                 JOIN PESSOA p ON p.id_pessoa = a.id_paciente
                 WHERE a.id_agendamento = ?`,
                [result.insertId]
            );
        });
        res.status(201).json(agendamento);
    } catch (error) {
        if (error.status === 409) return res.status(409).json({ erro: error.message });
        if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({ erro: 'Paciente ou terapeuta não encontrado.' });
        }
        throw error;
    }
});

// Quem pode mudar o status, e para quê:
// - o responsável confirma ou cancela uma consulta que ainda não aconteceu;
// - o terapeuta marca como realizada uma consulta confirmada, depois do horário.
const transicoes = {
    paciente: { Agendado: ['Confirmado', 'Cancelado'], Confirmado: ['Cancelado'] },
    terapeuta: { Confirmado: ['Realizado'] }
};

router.patch('/:id/status', async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!Number.isSafeInteger(id) || id < 1 || !statusValidos.includes(status)) {
        return res.status(400).json({ erro: 'ID ou status inválido.' });
    }
    const appointment = await db.get(
        `SELECT id_agendamento, data_agendamento, hora_agendamento, status, id_terapeuta, id_paciente
         FROM AGENDAMENTO WHERE id_agendamento = ?`,
        [id]
    );
    const { tipo, id: idUsuario } = req.usuario;
    const dono = appointment && Number(tipo === 'paciente' ? appointment.id_paciente : appointment.id_terapeuta) === Number(idUsuario);
    if (!dono) return res.status(404).json({ erro: 'Agendamento não encontrado.' });

    if (!(transicoes[tipo][appointment.status] || []).includes(status)) {
        return res.status(409).json({
            erro: tipo === 'paciente'
                ? 'Esta consulta não pode mais ser confirmada ou cancelada.'
                : 'Só é possível marcar como realizada uma consulta confirmada pelo responsável.'
        });
    }
    const agora = new Date();
    const inicio = `${String(appointment.data_agendamento).slice(0, 10)} ${String(appointment.hora_agendamento).slice(0, 5)}`;
    const jaComecou = inicio <= `${dataLocal(agora)} ${agora.toTimeString().slice(0, 5)}`;
    if (tipo === 'paciente' && jaComecou) {
        return res.status(409).json({ erro: 'O horário desta consulta já passou.' });
    }
    if (tipo === 'terapeuta' && !jaComecou) {
        return res.status(409).json({ erro: 'A consulta só pode ser marcada como realizada depois do horário marcado.' });
    }

    await db.run('UPDATE AGENDAMENTO SET status = ? WHERE id_agendamento = ?', [status, id]);
    res.json({ id_agendamento: id, status });
});

module.exports = router;
