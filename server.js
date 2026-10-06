// As regras de data e hora (agenda, mensagens) seguem o horário de Brasília,
// mesmo se o servidor onde o sistema for publicado estiver em outro fuso.
process.env.TZ = process.env.TZ || 'America/Sao_Paulo';

const express = require('express');
const path = require('node:path');
const db = require('./src/database/db');
const { exigirLogin, exigirTerapeuta } = require('./src/middleware/auth');

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
    if (!req.body) req.body = {};
    next();
});
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/pacientes', exigirLogin, exigirTerapeuta, require('./src/routes/pacientes'));
app.use('/api/agendamentos', exigirLogin, require('./src/routes/agendamentos'));
app.use('/api/prontuarios', exigirLogin, exigirTerapeuta, require('./src/routes/prontuarios'));
app.use('/api/mensagens', exigirLogin, require('./src/routes/mensagens'));

app.use((req, res) => {
    res.status(404).json({ erro: 'Recurso não encontrado.' });
});

app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({
        erro: err.status && err.status < 500 ? err.message : 'Erro interno do servidor.'
    });
});

db.initialize()
    .then(() => {
        const servidor = app.listen(port, () => console.log(`Servidor rodando em http://localhost:${port}`));
        servidor.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`A porta ${port} já está em uso. Outro servidor do SGT-TO provavelmente continua aberto:`
                    + ' feche o outro terminal (Ctrl+C) e rode npm start de novo.');
            } else {
                console.error('Não foi possível iniciar o servidor:', error);
            }
            process.exit(1);
        });
    })
    .catch((error) => {
        console.error('Não foi possível inicializar o banco de dados:', error);
        process.exitCode = 1;
    });
