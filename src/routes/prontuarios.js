// ===========================================================================
//                   Rotas de prontuário (/api/prontuarios)
//   Evoluções clínicas: só inclusão, nunca edição ou exclusão.
// ===========================================================================

const express = require('express');
const db = require('../database/db');

const router = express.Router();

// ---------------------------------------------------------------------------
//                       GET /paciente/:id (histórico)
// ---------------------------------------------------------------------------
router.get('/paciente/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ erro: 'ID do paciente inválido.' });
    const prontuarios = await db.all(
        `SELECT pr.id_prontuario, pr.data_registro, pr.descricao,
                pr.id_paciente, pr.id_terapeuta, p.nome AS nome_paciente, t.nome AS nome_terapeuta
         FROM PRONTUARIO pr
         JOIN PESSOA p ON p.id_pessoa = pr.id_paciente
         JOIN PESSOA t ON t.id_pessoa = pr.id_terapeuta
         WHERE pr.id_paciente = ?
         ORDER BY pr.data_registro DESC, pr.id_prontuario DESC`,
        [id]
    );
    res.json(prontuarios);
});

// ---------------------------------------------------------------------------
//                           POST / (nova evolução)
//   O terapeuta vem do token, não do formulário.
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
    const data = typeof req.body.data_registro === 'string' ? req.body.data_registro : '';
    const descricao = typeof req.body.descricao === 'string' ? req.body.descricao.trim() : '';
    const idPaciente = Number(req.body.id_paciente);
    const idTerapeuta = Number(req.usuario.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !descricao || descricao.length > 10000
        || !Number.isSafeInteger(idPaciente) || idPaciente < 1
        || !Number.isSafeInteger(idTerapeuta) || idTerapeuta < 1) {
        return res.status(400).json({ erro: 'Informe paciente, data e descrição válidos.' });
    }
    if (new Date(`${data}T00:00:00Z`).toISOString().slice(0, 10) !== data) {
        return res.status(400).json({ erro: 'A data informada não é válida.' });
    }
    const [paciente, terapeuta] = await Promise.all([
        db.get('SELECT id_pessoa FROM PACIENTE WHERE id_pessoa = ?', [idPaciente]),
        db.get('SELECT id_pessoa FROM TERAPEUTA WHERE id_pessoa = ?', [idTerapeuta])
    ]);
    if (!paciente || !terapeuta) return res.status(400).json({ erro: 'Paciente ou terapeuta não encontrado.' });

    const result = await db.run(
        'INSERT INTO PRONTUARIO (data_registro, descricao, id_paciente, id_terapeuta) VALUES (?, ?, ?, ?)',
        [data, descricao, idPaciente, idTerapeuta]
    );
    const prontuario = await db.get(
        `SELECT pr.id_prontuario, pr.data_registro, pr.descricao,
                pr.id_paciente, pr.id_terapeuta, p.nome AS nome_paciente, t.nome AS nome_terapeuta
         FROM PRONTUARIO pr
         JOIN PESSOA p ON p.id_pessoa = pr.id_paciente
         JOIN PESSOA t ON t.id_pessoa = pr.id_terapeuta
         WHERE pr.id_prontuario = ?`,
        [result.insertId]
    );
    res.status(201).json(prontuario);
});

module.exports = router;
