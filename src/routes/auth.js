const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');

const router = express.Router();

router.post('/login', async (req, res) => {
    const { tipo = 'terapeuta', login, cpf, senha } = req.body;
    const identificador = String(login || cpf || '').replace(/\D/g, '');
    if (!identificador || typeof senha !== 'string' || !senha) {
        return res.status(400).json({ erro: 'Informe o CPF e a senha.' });
    }
    if (!['terapeuta', 'paciente'].includes(tipo)) {
        return res.status(400).json({ erro: 'Tipo de acesso inválido.' });
    }

    const tabela = tipo === 'terapeuta' ? 'TERAPEUTA' : 'PACIENTE';
    const usuario = await db.get(
        `SELECT p.id_pessoa, p.nome, p.cpf, p.senha
         FROM PESSOA p JOIN ${tabela} perfil ON perfil.id_pessoa = p.id_pessoa
         WHERE p.cpf = ?`,
        [identificador]
    );
    if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
        return res.status(401).json({ erro: 'CPF ou senha incorretos.' });
    }

    return res.json({
        sucesso: true,
        usuario: { id: usuario.id_pessoa, nome: usuario.nome, tipo }
    });
});

module.exports = router;
