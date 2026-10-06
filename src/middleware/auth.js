// ===========================================================================
//                     Autenticação (middleware/auth.js)
//   Cria e confere o token que prova quem está logado.
// ===========================================================================

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
//                              Segredo do token
// ---------------------------------------------------------------------------
// Sem SESSION_SECRET, o segredo fica salvo em um arquivo local (fora do Git)
// para que reiniciar o servidor não derrube quem já está logado.
const ARQUIVO_SEGREDO = path.join(__dirname, '..', '..', '.session-secret');

function carregarSegredo() {
    if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
    try {
        const salvo = fs.readFileSync(ARQUIVO_SEGREDO, 'utf8').trim();
        if (salvo) return salvo;
    } catch {
        // arquivo ainda não existe
    }
    const novo = crypto.randomBytes(32).toString('hex');
    try {
        fs.writeFileSync(ARQUIVO_SEGREDO, novo, { mode: 0o600 });
    } catch (error) {
        console.warn('Não foi possível salvar o segredo da sessão:', error.message);
    }
    return novo;
}

const SEGREDO = carregarSegredo();
const DURACAO_MS = 8 * 60 * 60 * 1000; // 8 horas

// ---------------------------------------------------------------------------
//                         Criação e leitura do token
//   O token é o usuário em base64 mais uma assinatura. Se mexerem no conteúdo, a assinatura não bate.
// ---------------------------------------------------------------------------
function assinar(conteudo) {
    return crypto.createHmac('sha256', SEGREDO).update(conteudo).digest('base64url');
}

function criarToken(usuario) {
    const payload = Buffer.from(JSON.stringify({
        id: usuario.id,
        tipo: usuario.tipo,
        exp: Date.now() + DURACAO_MS
    })).toString('base64url');
    return `${payload}.${assinar(payload)}`;
}

function lerToken(token) {
    const [payload, assinatura] = String(token || '').split('.');
    if (!payload || !assinatura) return null;
    const esperada = assinar(payload);
    if (assinatura.length !== esperada.length
        || !crypto.timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperada))) {
        return null;
    }
    try {
        const dados = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        return dados.exp > Date.now() ? dados : null;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
//                             Controle de acesso
//   exigirLogin barra quem não tem token válido. exigirTerapeuta barra o responsável.
// ---------------------------------------------------------------------------
function exigirLogin(req, res, next) {
    const cabecalho = req.get('Authorization') || '';
    const usuario = lerToken(cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : '');
    if (!usuario) return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
    req.usuario = usuario;
    next();
}

function exigirTerapeuta(req, res, next) {
    if (req.usuario?.tipo !== 'terapeuta') {
        return res.status(403).json({ erro: 'Acesso restrito aos terapeutas.' });
    }
    next();
}

module.exports = { criarToken, exigirLogin, exigirTerapeuta };
