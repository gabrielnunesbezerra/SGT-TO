// ===========================================================================
//                    Rotas de pacientes (/api/pacientes)
//   Cadastro, edição e exclusão de pacientes. Só o terapeuta acessa.
// ===========================================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const db = require('../database/db');

const router = express.Router();

// ---------------------------------------------------------------------------
//                               Consulta base
//   SELECT reaproveitado em todas as rotas abaixo.
// ---------------------------------------------------------------------------
const pacienteSelect = `SELECT p.id_pessoa, p.nome, p.cpf, p.telefone, pa.nome_responsavel
    FROM PESSOA p JOIN PACIENTE pa ON pa.id_pessoa = p.id_pessoa`;

// ---------------------------------------------------------------------------
//                            Validação dos dados
// ---------------------------------------------------------------------------
function pessoaInput(body) {
    const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
    const cpf = typeof body.cpf === 'string' ? body.cpf.replace(/\D/g, '') : '';
    const telefone = typeof body.telefone === 'string' ? body.telefone.trim() : '';
    const nomeResponsavel = typeof body.nome_responsavel === 'string' ? body.nome_responsavel.trim() : '';
    return { nome, cpf, telefone, nomeResponsavel };
}

function inputValido(input) {
    return input.nome.length > 0 && input.nome.length <= 160
        && input.cpf.length === 11
        && input.telefone.length > 0 && input.telefone.length <= 30
        && input.nomeResponsavel.length <= 160;
}

// A senha é opcional: vazia significa "não definir" (cadastro) ou "manter a atual" (edição).
function senhaInformada(body) {
    return typeof body.senha === 'string' && body.senha !== '' ? body.senha : null;
}

function senhaInvalida(body) {
    return body.senha !== undefined && body.senha !== ''
        && (typeof body.senha !== 'string' || body.senha.length < 6 || body.senha.length > 72);
}

// ---------------------------------------------------------------------------
//                          GET / (listar pacientes)
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
    const pacientes = await db.all(`${pacienteSelect} ORDER BY p.nome`);
    res.json(pacientes);
});

// ---------------------------------------------------------------------------
//                        POST / (cadastrar paciente)
//   Cria a PESSOA e o PACIENTE na mesma transação.
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
    const input = pessoaInput(req.body);
    if (!inputValido(input)) {
        return res.status(400).json({ erro: 'Informe nome, CPF com 11 dígitos e telefone válidos.' });
    }
    if (senhaInvalida(req.body)) {
        return res.status(400).json({ erro: 'A senha de acesso deve ter entre 6 e 72 caracteres.' });
    }
    const senha = senhaInformada(req.body) || crypto.randomBytes(32).toString('hex');
    const hash = await bcrypt.hash(senha, 10);

    try {
        const id = await db.transaction(async (tx) => {
            const pessoa = await tx.run(
                'INSERT INTO PESSOA (nome, cpf, senha, telefone) VALUES (?, ?, ?, ?)',
                [input.nome, input.cpf, hash, input.telefone]
            );
            await tx.run(
                'INSERT INTO PACIENTE (id_pessoa, nome_responsavel) VALUES (?, ?)',
                [pessoa.insertId, input.nomeResponsavel]
            );
            return pessoa.insertId;
        });
        const paciente = await db.get(`${pacienteSelect} WHERE p.id_pessoa = ?`, [id]);
        res.status(201).json(paciente);
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ erro: 'Já existe uma pessoa cadastrada com esse CPF.' });
        }
        throw error;
    }
});

// ---------------------------------------------------------------------------
//                         PUT /:id (editar paciente)
//   Senha em branco mantém a atual.
// ---------------------------------------------------------------------------
router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const input = pessoaInput(req.body);
    if (!Number.isSafeInteger(id) || id < 1 || !inputValido(input)) {
        return res.status(400).json({ erro: 'Dados do paciente inválidos.' });
    }
    if (senhaInvalida(req.body)) {
        return res.status(400).json({ erro: 'A senha de acesso deve ter entre 6 e 72 caracteres.' });
    }
    const novaSenha = senhaInformada(req.body);
    const hash = novaSenha ? await bcrypt.hash(novaSenha, 10) : null;

    try {
        const result = await db.transaction(async (tx) => {
            const paciente = await tx.get('SELECT id_pessoa FROM PACIENTE WHERE id_pessoa = ?', [id]);
            if (!paciente) return false;
            await tx.run(
                'UPDATE PESSOA SET nome = ?, cpf = ?, telefone = ? WHERE id_pessoa = ?',
                [input.nome, input.cpf, input.telefone, id]
            );
            await tx.run(
                'UPDATE PACIENTE SET nome_responsavel = ? WHERE id_pessoa = ?',
                [input.nomeResponsavel, id]
            );
            if (hash) await tx.run('UPDATE PESSOA SET senha = ? WHERE id_pessoa = ?', [hash, id]);
            return true;
        });
        if (!result) return res.status(404).json({ erro: 'Paciente não encontrado.' });
        res.json(await db.get(`${pacienteSelect} WHERE p.id_pessoa = ?`, [id]));
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ erro: 'Já existe uma pessoa cadastrada com esse CPF.' });
        }
        throw error;
    }
});

// ---------------------------------------------------------------------------
//                       DELETE /:id (excluir paciente)
//   Só exclui quem não tem consulta, prontuário nem mensagem.
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ erro: 'ID inválido.' });
    const paciente = await db.get('SELECT id_pessoa FROM PACIENTE WHERE id_pessoa = ?', [id]);
    if (!paciente) return res.status(404).json({ erro: 'Paciente não encontrado.' });
    const historico = await db.get(
        `SELECT
            (SELECT COUNT(*) FROM AGENDAMENTO WHERE id_paciente = ?) AS agendamentos,
            (SELECT COUNT(*) FROM PRONTUARIO WHERE id_paciente = ?) AS prontuarios,
            (SELECT COUNT(*) FROM MENSAGEM WHERE id_paciente = ?) AS mensagens`,
        [id, id, id]
    );
    if (Number(historico.agendamentos) + Number(historico.prontuarios) + Number(historico.mensagens) > 0) {
        return res.status(409).json({ erro: 'Não é possível remover um paciente com atendimentos ou registros vinculados.' });
    }
    await db.run('DELETE FROM PESSOA WHERE id_pessoa = ?', [id]);
    res.json({ sucesso: true, mensagem: 'Paciente removido.' });
});

module.exports = router;
