(() => {
    const sair = (aviso) => {
        sessionStorage.removeItem('sgt-token');
        sessionStorage.removeItem('sgt-usuario');
        if (aviso) sessionStorage.setItem('sgt-aviso', aviso);
        window.location.replace('/Login.html');
    };
    const api = async (url, options = {}) => {
        const token = sessionStorage.getItem('sgt-token');
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...options.headers
            }
        });
        if (response.status === 401) {
            sair('Sua sessão expirou. Entre novamente para continuar.');
            throw new Error('Sessão expirada. Faça login novamente.');
        }
        const payload = response.status === 204 ? null : await response.json();
        if (!response.ok) throw new Error(payload?.erro || 'Não foi possível concluir a solicitação.');
        return payload;
    };
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
    const localDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const dateLabel = (value, options = { day: '2-digit', month: 'short' }) => {
        const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
        return new Intl.DateTimeFormat('pt-BR', options).format(date);
    };
    const usuario = (() => {
        try {
            return JSON.parse(sessionStorage.getItem('sgt-usuario') || 'null');
        } catch (error) {
            return null;
        }
    })();
    window.SGT = { api, escapeHtml, localDate, dateLabel, sair, usuario };

    const outlet = document.querySelector('[data-site-nav]');
    if (!outlet) return;
    const current = location.pathname.toLowerCase();
    if (!usuario || !sessionStorage.getItem('sgt-token')) {
        sair();
        return;
    }
    const ehPaciente = usuario.tipo === 'paciente';
    const inicio = ehPaciente ? '/consultas.html' : '/painel.html';
    const links = ehPaciente
        ? [['/consultas.html', 'Minhas consultas'], ['/mensagens.html', 'Mensagens']]
        : [
            ['/painel.html', 'Painel'],
            ['/agenda.html', 'Agenda'],
            ['/consultas.html', 'Consultas'],
            ['/pacientes.html', 'Pacientes'],
            ['/prontuarios.html', 'Prontuários'],
            ['/mensagens.html', 'Mensagens']
        ];
    if (!links.some(([href]) => href === current)) {
        window.location.replace(inicio);
        return;
    }
    const profileHtml = `
        <div class="topbar-user">
        <div class="profile-pill" aria-label="Perfil do usuário atual">
            <span class="profile-avatar">${escapeHtml((usuario.nome || 'U').split(' ').slice(0, 2).map((part) => part[0]).join('').slice(0, 2).toUpperCase())}</span>
            <div class="profile-copy">
                <strong>${escapeHtml(usuario.nome || 'Usuário')}</strong>
                <small>${usuario.tipo === 'terapeuta' ? 'Terapeuta' : 'Responsável'}</small>
            </div>
        </div>
        <button type="button" class="button secondary logout-button" id="btn-sair">Sair</button>
        </div>`;
    outlet.innerHTML = `
        <header class="topbar">
            <a class="brand" href="${inicio}" aria-label="SGT-O, ir para o início">
                <span class="brand-mark">SG</span>
                <span><span class="brand-name">SGT-O</span><span class="brand-caption">Terapia ocupacional</span></span>
            </a>
            <nav class="main-nav" aria-label="Navegação principal">
                ${links.map(([href, label]) => `<a class="nav-link ${current === href ? 'active' : ''}" href="${href}" ${current === href ? 'aria-current="page"' : ''}>${label}</a>`).join('')}
            </nav>
            ${profileHtml}
        </header>`;
    document.getElementById('btn-sair').addEventListener('click', () => sair());
})();
