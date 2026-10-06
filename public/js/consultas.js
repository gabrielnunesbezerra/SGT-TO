// ===========================================================================
//                      Tela de consultas (consultas.js)
//   O responsável confirma ou cancela. O terapeuta marca como realizada.
// ===========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // -----------------------------------------------------------------------
    //                           Elementos da tela
    // -----------------------------------------------------------------------
    const body = document.getElementById('consultas-body');
    const message = document.getElementById('consultas-message');
    const search = document.getElementById('consulta-search');
    const filter = document.getElementById('status-filter');
    let appointments = [];
    const currentUser = SGT.usuario;
    const ehPaciente = currentUser?.tipo === 'paciente';

    // -----------------------------------------------------------------------
    //                       Ajustes para o responsável
    // -----------------------------------------------------------------------
    if (ehPaciente) {
        document.querySelector('.page-heading .button')?.remove();
        document.querySelector('.page-heading h1').textContent = 'Minhas consultas';
        document.querySelector('.page-heading p').textContent = 'Acompanhe as datas e o andamento dos seus atendimentos.';
        document.querySelector('.consultations-toolbar h2').textContent = 'Seus agendamentos';
    }

    // -----------------------------------------------------------------------
    //                           Regras dos botões
    // -----------------------------------------------------------------------
    function agoraLocal() {
        return `${SGT.localDate(new Date())} ${new Date().toTimeString().slice(0, 5)}`;
    }
    function jaComecou(item) {
        return `${String(item.data_agendamento).slice(0, 10)} ${String(item.hora_agendamento).slice(0, 5)}` <= agoraLocal();
    }
    // O responsável confirma ou cancela; o terapeuta só marca como realizada depois do horário.
    function acoes(item) {
        const id = item.id_agendamento;
        if (ehPaciente) {
            if (jaComecou(item)) return '';
            if (item.status === 'Agendado') {
                return `<div class="action-buttons">
                    <button class="button small" type="button" data-id="${id}" data-status="Confirmado">Confirmar</button>
                    <button class="button small secondary" type="button" data-id="${id}" data-status="Cancelado">Cancelar</button>
                </div>`;
            }
            if (item.status === 'Confirmado') {
                return `<button class="button small secondary" type="button" data-id="${id}" data-status="Cancelado">Cancelar</button>`;
            }
            return '';
        }
        if (item.status === 'Agendado') {
            return `<span class="action-hint">${jaComecou(item) ? 'Não foi confirmada pelo responsável' : 'Aguardando o responsável'}</span>`;
        }
        if (item.status === 'Confirmado') {
            return jaComecou(item)
                ? `<button class="button small" type="button" data-id="${id}" data-status="Realizado">Marcar como realizada</button>`
                : '<span class="action-hint">Confirmada pelo responsável</span>';
        }
        return '';
    }

    // -----------------------------------------------------------------------
    //                          Aviso de pendências
    // -----------------------------------------------------------------------
    function showPending() {
        if (!ehPaciente) return;
        const pendentes = appointments.filter((item) => item.status === 'Agendado' && !jaComecou(item)).length;
        if (pendentes) {
            message.textContent = pendentes === 1
                ? 'Você tem 1 consulta aguardando sua confirmação.'
                : `Você tem ${pendentes} consultas aguardando sua confirmação.`;
            message.className = 'notice success';
        } else {
            message.className = 'notice hidden';
        }
    }

    // -----------------------------------------------------------------------
    //                          Tabela de consultas
    // -----------------------------------------------------------------------
    function render() {
        const query = search.value.trim().toLocaleLowerCase('pt-BR');
        const status = filter.value;
        const visible = appointments.filter((item) => {
            const matchesText = `${item.nome_paciente} ${item.nome_terapeuta}`.toLocaleLowerCase('pt-BR').includes(query);
            return matchesText && (!status || item.status === status);
        });
        document.getElementById('consultas-count').textContent = `${visible.length} ${visible.length === 1 ? 'consulta' : 'consultas'}`;
        if (!visible.length) {
            body.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhuma consulta encontrada com esses filtros.</td></tr>';
            return;
        }
        body.innerHTML = visible.map((item) => `
            <tr>
                <td><span class="person-name">${SGT.escapeHtml(item.nome_paciente)}</span></td>
                <td>${SGT.escapeHtml(item.nome_terapeuta)}</td>
                <td>${SGT.escapeHtml(SGT.dateLabel(item.data_agendamento, { day: '2-digit', month: 'long', year: 'numeric' }))}</td>
                <td>${SGT.escapeHtml(String(item.hora_agendamento).slice(0, 5))}</td>
                <td><span class="badge ${SGT.escapeHtml(item.status.toLowerCase())}">${SGT.escapeHtml(item.status)}</span></td>
                <td>${acoes(item)}</td>
            </tr>`).join('');
    }

    // -----------------------------------------------------------------------
    //                              Carregamento
    // -----------------------------------------------------------------------
    async function load() {
        try {
            const query = currentUser && currentUser.tipo === 'terapeuta'
                ? `/api/agendamentos?id_terapeuta=${currentUser.id}`
                : '/api/agendamentos';
            appointments = await SGT.api(query);
            render();
            showPending();
        } catch (error) {
            message.textContent = error.message;
            message.className = 'notice error';
            body.innerHTML = '<tr><td colspan="6" class="empty-state">Não foi possível carregar as consultas.</td></tr>';
        }
    }

    // -----------------------------------------------------------------------
    //                                Eventos
    // -----------------------------------------------------------------------
    search.addEventListener('input', render);
    filter.addEventListener('change', render);
    body.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-status]');
        if (!button) return;
        const appointment = appointments.find((item) => Number(item.id_agendamento) === Number(button.dataset.id));
        if (!appointment) return;
        const novoStatus = button.dataset.status;
        if (novoStatus === 'Cancelado') {
            const quando = `${SGT.dateLabel(appointment.data_agendamento)} às ${String(appointment.hora_agendamento).slice(0, 5)}`;
            if (!confirm(`Cancelar a consulta de ${quando}? Depois de cancelada ela não pode ser reativada.`)) return;
        }
        button.disabled = true;
        try {
            await SGT.api(`/api/agendamentos/${appointment.id_agendamento}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: novoStatus })
            });
            appointment.status = novoStatus;
            render();
            const textos = { Confirmado: 'Consulta confirmada.', Cancelado: 'Consulta cancelada.', Realizado: 'Consulta marcada como realizada.' };
            message.textContent = textos[novoStatus];
            message.className = 'notice success';
        } catch (error) {
            message.textContent = error.message;
            message.className = 'notice error';
            button.disabled = false;
        }
    });

    // -----------------------------------------------------------------------
    //                                 Início
    // -----------------------------------------------------------------------
    load();
});
