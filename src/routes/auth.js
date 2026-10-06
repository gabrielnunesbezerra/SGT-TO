// ===========================================================================
//                         Rota de login (/api/auth)
//   Confere usuário ou CPF e senha e devolve o token.
// ===========================================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { criarToken } = require('../middleware/auth');

const router = express.Router();

// ---------------------------------------------------------------------------
//                          Normalização do usuário
//   Tira acentos, espaços e maiúsculas para comparar o login digitado.
// ---------------------------------------------------------------------------
function normalizeLogin(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
        .trim();
}

// ---------------------------------------------------------------------------
//                                POST /login
//   Terapeuta entra com o usuário. Responsável entra com o CPF do paciente.
// ---------------------------------------------------------------------------
router.post('/login', async (req, res) => {
    const { tipo = 'terapeuta', login, cpf, senha } = req.body;
    const identificador = String(login || cpf || '').trim();
    if (!identificador || typeof senha !== 'string' || !senha) {
        return res.status(400).json({ erro: 'Informe o usuário ou CPF e a senha.' });
    }
    if (!['terapeuta', 'paciente'].includes(tipo)) {
        return res.status(400).json({ erro: 'Tipo de acesso inválido.' });
    }

    if (tipo === 'paciente') {
        const cpfLimpo = identificador.replace(/\D/g, '');
        const usuario = await db.get(
            `SELECT p.id_pessoa, p.nome, p.cpf, p.senha
             FROM PESSOA p JOIN PACIENTE perfil ON perfil.id_pessoa = p.id_pessoa
             WHERE p.cpf = ?`,
            [cpfLimpo]
        );
        if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
            return res.status(401).json({ erro: 'CPF ou senha incorretos.' });
        }
        const dados = { id: usuario.id_pessoa, nome: usuario.nome, tipo };
        return res.json({ sucesso: true, token: criarToken(dados), usuario: dados });
    }

    const usuarios = await db.all(
        `SELECT p.id_pessoa, p.nome, p.cpf, p.senha
         FROM PESSOA p JOIN TERAPEUTA perfil ON perfil.id_pessoa = p.id_pessoa`
    );

    const loginNormalizado = normalizeLogin(identificador);
    const usuario = usuarios.find((item) => {
        const cpfAlternativo = String(item.cpf || '').replace(/\D/g, '');
        const nomeNormalizado = normalizeLogin(item.nome);
        const nomeSemEspaco = normalizeLogin(item.nome.replace(/\s+/g, ''));
        const nomePrimeiro = normalizeLogin(item.nome.split(/\s+/)[0] || '');
        const variacoes = new Set([nomeNormalizado, nomeSemEspaco, nomePrimeiro, cpfAlternativo]);
        return variacoes.has(loginNormalizado);
    });

    if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
        return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
    }

    const dados = { id: usuario.id_pessoa, nome: usuario.nome, tipo };
    return res.json({ sucesso: true, token: criarToken(dados), usuario: dados });
});

module.exports = router;
