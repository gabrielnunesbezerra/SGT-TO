// ===========================================================================
//                      Tela de mensagens (mensagens.js)
//   Conversa entre terapeuta e responsável. Atualiza sozinha a cada 15 segundos.
// ===========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // -----------------------------------------------------------------------
    //                           Elementos da tela
    // -----------------------------------------------------------------------
    const contactsList = document.getElementById('contacts-list');
    const thread = document.getElementById('chat-thread');
    const chatTitle = document.getElementById('chat-title');
    const form = document.getElementById('chat-form');
    const input = document.getElementById('chat-input');
    const submit = form.querySelector('[type="submit"]');
    const message = document.getElementById('messages-message');
    const usuario = SGT.usuario;
    const ehPaciente = usuario?.tipo === 'paciente';
    let contacts = [];
    let selectedId = null;
    let lastSignature = '';

    // -----------------------------------------------------------------------
    //                           Textos por perfil
    // -----------------------------------------------------------------------
    if (ehPaciente) {
        document.getElementById('contacts-title').textContent = 'Terapeutas';
        document.getElementById('messages-subtitle').textContent = 'Fale com a equipe do consultório sobre dúvidas e atendimentos.';
    } else {
        document.getElementById('contacts-title').textContent = 'Pacientes';
    }

    // -----------------------------------------------------------------------
    //                           Funções auxiliares
    // -----------------------------------------------------------------------
    function showError(error) {
        message.textContent = error.message;
        message.className = 'notice error';
    }
    function formatDateTime(value) {
        const [date, time = ''] = String(value).split(/[ T]/);
        const [, month, day] = date.split('-');
        return `${day}/${month} ${time.slice(0, 5)}`;
    }

    // -----------------------------------------------------------------------
    //                           Lista de contatos
    // -----------------------------------------------------------------------
    function renderContacts() {
        if (!contacts.length) {
            contactsList.innerHTML = '<div class="empty-state">Nenhum contato disponível.</div>';
            return;
        }
        contactsList.innerHTML = contacts.map((contact) => `
            <button type="button" class="contact-item ${Number(contact.id) === selectedId ? 'active' : ''}" data-contact-id="${contact.id}">
                <strong>${SGT.escapeHtml(contact.nome)}</strong>
                <small>${contact.ultima_mensagem
                    ? `Última mensagem em ${SGT.escapeHtml(formatDateTime(contact.ultima_mensagem))}`
                    : SGT.escapeHtml(contact.especialidade || 'Sem mensagens ainda')}</small>
            </button>`).join('');
    }

    // -----------------------------------------------------------------------
    //                                Conversa
    // -----------------------------------------------------------------------
    function renderThread(messages) {
        const signature = messages.map((item) => item.id_mensagem).join(',');
        if (signature === lastSignature) return;
        lastSignature = signature;
        if (!messages.length) {
            thread.innerHTML = '<div class="empty-state">Nenhuma mensagem ainda. Envie a primeira.</div>';
            return;
        }
        thread.innerHTML = messages.map((item) => `
            <div class="bubble ${item.remetente === usuario.tipo ? 'mine' : ''}">
                <p>${SGT.escapeHtml(item.conteudo)}</p>
                <time>${SGT.escapeHtml(formatDateTime(item.data_envio))}</time>
            </div>`).join('');
        thread.scrollTop = thread.scrollHeight;
    }

    // -----------------------------------------------------------------------
    //                              Carregamento
    // -----------------------------------------------------------------------
    async function loadThread() {
        if (!selectedId) return;
        try {
            renderThread(await SGT.api(`/api/mensagens/${selectedId}`));
        } catch (error) {
            showError(error);
        }
    }
    async function loadContacts() {
        contacts = await SGT.api('/api/mensagens/contatos');
        renderContacts();
    }
    function selectContact(id) {
        const contact = contacts.find((item) => Number(item.id) === Number(id));
        if (!contact) return;
        selectedId = Number(contact.id);
        lastSignature = null;
        chatTitle.textContent = contact.nome;
        thread.innerHTML = '<div class="loading-state">Carregando mensagens...</div>';
        input.disabled = false;
        submit.disabled = false;
        message.className = 'notice hidden';
        renderContacts();
        loadThread();
        input.focus();
    }

    // -----------------------------------------------------------------------
    //                                Eventos
    // -----------------------------------------------------------------------
    contactsList.addEventListener('click', (event) => {
        const button = event.target.closest('[data-contact-id]');
        if (button) selectContact(button.dataset.contactId);
    });
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            form.requestSubmit();
        }
    });
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const conteudo = input.value.trim();
        if (!selectedId || !conteudo) return;
        submit.disabled = true;
        try {
            await SGT.api('/api/mensagens', {
                method: 'POST',
                body: JSON.stringify({ id_contato: selectedId, conteudo })
            });
            input.value = '';
            await loadThread();
            await loadContacts();
        } catch (error) {
            showError(error);
        } finally {
            submit.disabled = false;
            input.focus();
        }
    });

    // -----------------------------------------------------------------------
    //                                 Início
    // -----------------------------------------------------------------------
    loadContacts().catch((error) => {
        showError(error);
        contactsList.innerHTML = '<div class="empty-state">Não foi possível carregar os contatos.</div>';
    });
    setInterval(() => {
        if (!document.hidden) loadThread();
    }, 15000);
});
