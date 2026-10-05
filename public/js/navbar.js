(() => {
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
    window.SGT = { api, escapeHtml, localDate, dateLabel };

    const outlet = document.querySelector('[data-site-nav]');
    if (!outlet) return;
    const links = [
        ['/painel.html', 'Painel'],
        ['/agenda.html', 'Agenda'],
        ['/consultas.html', 'Consultas'],
        ['/pacientes.html', 'Pacientes']
    ];
    const current = location.pathname.toLowerCase();
    const usuario = (() => {
        try {
            return JSON.parse(sessionStorage.getItem('sgt-usuario') || 'null');
        } catch (error) {
            return null;
        }
    })();
    const profileHtml = usuario ? `
        <div class="profile-pill" aria-label="Perfil do usuário atual">
            <span class="profile-avatar">${escapeHtml((usuario.nome || 'U').split(' ').slice(0, 2).map((part) => part[0]).join('').slice(0, 2).toUpperCase())}</span>
            <div class="profile-copy">
                <strong>${escapeHtml(usuario.nome || 'Usuário')}</strong>
                <small>${usuario.tipo === 'terapeuta' ? 'Terapeuta' : 'Responsável'}</small>
            </div>
        </div>` : '<span class="topbar-end">Gestão clínica</span>';
    outlet.innerHTML = `
        <header class="topbar">
            <a class="brand" href="/painel.html" aria-label="SGT-O, ir ao painel">
                <span class="brand-mark">SG</span>
                <span><span class="brand-name">SGT-O</span><span class="brand-caption">Terapia ocupacional</span></span>
            </a>
            <nav class="main-nav" aria-label="Navegação principal">
                ${links.map(([href, label]) => `<a class="nav-link ${current === href ? 'active' : ''}" href="${href}" ${current === href ? 'aria-current="page"' : ''}>${label}</a>`).join('')}
            </nav>
            ${profileHtml}
        </header>`;
})();
