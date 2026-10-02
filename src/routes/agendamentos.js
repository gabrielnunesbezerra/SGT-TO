const express = require('express');
const db = require('../database/db');

const router = express.Router();
const statusValidos = ['Agendado', 'Confirmado', 'Realizado', 'Cancelado'];

router.get('/terapeutas', async (req, res) => {
    const terapeutas = await db.all(
        `SELECT p.id_pessoa, p.nome, t.especialidade
         FROM TERAPEUTA t JOIN PESSOA p ON p.id_pessoa = t.id_pessoa
         ORDER BY p.nome`
    );
    res.json(terapeutas);
});

router.get('/', async (req, res) => {
    const { inicio, fim } = req.query;
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

router.post('/', async (req, res) => {
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

    const terapeuta = await db.get('SELECT id_pessoa FROM TERAPEUTA WHERE id_pessoa = ?', [idTerapeuta]);
    const paciente = await db.get('SELECT id_pessoa FROM PACIENTE WHERE id_pessoa = ?', [idPaciente]);
    if (!terapeuta || !paciente) {
        return res.status(400).json({ erro: 'Paciente ou terapeuta não encontrado.' });
    }
    const horaCompleta = `${hora}:00`;
    try {
        const agendamento = await db.transaction(async (tx) => {
            await tx.lockTherapist(idTerapeuta);
            const choque = await tx.get(
                `SELECT id_agendamento FROM AGENDAMENTO
                 WHERE data_agendamento = ? AND hora_agendamento = ? AND id_terapeuta = ?
                   AND status <> 'Cancelado'`,
                [data, horaCompleta, idTerapeuta]
            );
            if (choque) {
                const error = new Error('O terapeuta já possui um atendimento nesse dia e horário.');
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

router.patch('/:id/status', async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!Number.isSafeInteger(id) || id < 1 || !statusValidos.includes(status)) {
        return res.status(400).json({ erro: 'ID ou status inválido.' });
    }
    const appointment = await db.get('SELECT id_agendamento FROM AGENDAMENTO WHERE id_agendamento = ?', [id]);
    if (!appointment) return res.status(404).json({ erro: 'Agendamento não encontrado.' });
    const result = await db.run('UPDATE AGENDAMENTO SET status = ? WHERE id_agendamento = ?', [status, id]);
    res.json({ id_agendamento: id, status });
});

module.exports = router;
