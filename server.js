const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/login', (req, res) => {
    const { tipo, login, senha } = req.body;
    

    if (senha === '123456') {
        return res.json({ sucesso: true, mensagem: `Login de ${tipo} autorizado!` });
    }
    
    res.status(401).json({ sucesso: false, mensagem: "Senha incorreta." });
});

app.listen(3000, () => console.log(' Servidor rodando em http://localhost:3000'));