// ===========================================================================
//                    Rotas de mensagens (/api/mensagens)
//   Conversa entre terapeuta e responsável.
// ===========================================================================

const express = require('express');
const db = require('../database/db');

const router = express.Router();

// ---------------------------------------------------------------------------
//                             Funções auxiliares
// ---------------------------------------------------------------------------
function agora() {
    const data = new Date();
    const dois = (valor) => String(valor).padStart(2, '0');
    return `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())} `
        + `${dois(data.getHours())}:${dois(data.getMinutes())}:${dois(data.getSeconds())}`;
}

function idValido(valor) {
    const id = Number(valor);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// Para o terapeuta, o contato é um paciente. Para o responsável, o contato é um terapeuta.
function participantes(usuario, idContato) {
    return usuario.tipo === 'terapeuta'
        ? { idTerapeuta: usuario.id, idPaciente: idContato, tabelaContato: 'PACIENTE' }
        : { idTerapeuta: idContato, idPaciente: usuario.id, tabelaContato: 'TERAPEUTA' };
}

// ---------------------------------------------------------------------------
//                               GET /contatos
//   O terapeuta vê os pacientes. O responsável vê os terapeutas.
// ---------------------------------------------------------------------------
router.get('/contatos', async (req, res) => {
    if (req.usuario.tipo === 'terapeuta') {
        const contatos = await db.all(
            `SELECT p.id_pessoa AS id, p.nome, MAX(m.data_envio) AS ultima_mensagem
             FROM PACIENTE pa
             JOIN PESSOA p ON p.id_pessoa = pa.id_pessoa
             LEFT JOIN MENSAGEM m ON m.id_paciente = pa.id_pessoa AND m.id_terapeuta = ?
             GROUP BY p.id_pessoa, p.nome
             ORDER BY ultima_mensagem DESC, p.nome`,
            [req.usuario.id]
        );
        return res.json(contatos);
    }
    const contatos = await db.all(
        `SELECT p.id_pessoa AS id, p.nome, t.especialidade, MAX(m.data_envio) AS ultima_mensagem
         FROM TERAPEUTA t
         JOIN PESSOA p ON p.id_pessoa = t.id_pessoa
         LEFT JOIN MENSAGEM m ON m.id_terapeuta = t.id_pessoa AND m.id_paciente = ?
         GROUP BY p.id_pessoa, p.nome, t.especialidade
         ORDER BY ultima_mensagem DESC, p.nome`,
        [req.usuario.id]
    );
    res.json(contatos);
});

// ---------------------------------------------------------------------------
//                              GET /:idContato
//   Todas as mensagens da conversa com aquele contato.
// ---------------------------------------------------------------------------
router.get('/:idContato', async (req, res) => {
    const idContato = idValido(req.params.idContato);
    if (!idContato) return res.status(400).json({ erro: 'Contato inválido.' });
    const { idTerapeuta, idPaciente } = participantes(req.usuario, idContato);
    const mensagens = await db.all(
        `SELECT id_mensagem, conteudo, data_envio, remetente
         FROM MENSAGEM
         WHERE id_terapeuta = ? AND id_paciente = ?
         ORDER BY data_envio, id_mensagem`,
        [idTerapeuta, idPaciente]
    );
    res.json(mensagens);
});

// ---------------------------------------------------------------------------
//                          POST / (enviar mensagem)
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
    const idContato = idValido(req.body.id_contato);
    const conteudo = typeof req.body.conteudo === 'string' ? req.body.conteudo.trim() : '';
    if (!idContato || !conteudo || conteudo.length > 2000) {
        return res.status(400).json({ erro: 'Escreva uma mensagem de até 2000 caracteres.' });
    }
    const { idTerapeuta, idPaciente, tabelaContato } = participantes(req.usuario, idContato);
    const contato = await db.get(`SELECT id_pessoa FROM ${tabelaContato} WHERE id_pessoa = ?`, [idContato]);
    if (!contato) return res.status(404).json({ erro: 'Contato não encontrado.' });

    const result = await db.run(
        `INSERT INTO MENSAGEM (conteudo, data_envio, id_terapeuta, id_paciente, remetente)
         VALUES (?, ?, ?, ?, ?)`,
        [conteudo, agora(), idTerapeuta, idPaciente, req.usuario.tipo]
    );
    const mensagem = await db.get(
        'SELECT id_mensagem, conteudo, data_envio, remetente FROM MENSAGEM WHERE id_mensagem = ?',
        [result.insertId]
    );
    res.status(201).json(mensagem);
});

module.exports = router;
