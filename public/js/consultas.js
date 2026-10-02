document.addEventListener('DOMContentLoaded', () => {
    const body = document.getElementById('consultas-body');
    const message = document.getElementById('consultas-message');
    const search = document.getElementById('consulta-search');
    const filter = document.getElementById('status-filter');
    let appointments = [];

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
                <td><label class="sr-only" for="status-${item.id_agendamento}">Alterar status da consulta de ${SGT.escapeHtml(item.nome_paciente)}</label>
                    <select class="status-select" id="status-${item.id_agendamento}" data-status-id="${item.id_agendamento}" aria-label="Alterar status">
                        ${['Agendado', 'Confirmado', 'Realizado', 'Cancelado'].map((value) => `<option ${value === item.status ? 'selected' : ''}>${value}</option>`).join('')}
                    </select>
                </td>
            </tr>`).join('');
    }
    async function load() {
        try {
            appointments = await SGT.api('/api/agendamentos');
            render();
        } catch (error) {
            message.textContent = error.message;
            message.className = 'notice error';
            body.innerHTML = '<tr><td colspan="6" class="empty-state">Não foi possível carregar as consultas.</td></tr>';
        }
    }
    search.addEventListener('input', render);
    filter.addEventListener('change', render);
    body.addEventListener('change', async (event) => {
        const select = event.target.closest('[data-status-id]');
        if (!select) return;
        const appointment = appointments.find((item) => Number(item.id_agendamento) === Number(select.dataset.statusId));
        if (!appointment || appointment.status === select.value) return;
        select.disabled = true;
        try {
            await SGT.api(`/api/agendamentos/${select.dataset.statusId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: select.value })
            });
            appointment.status = select.value;
            message.textContent = 'Status da consulta atualizado.';
            message.className = 'notice success';
            render();
        } catch (error) {
            message.textContent = error.message;
            message.className = 'notice error';
            select.value = appointment.status;
        } finally {
            select.disabled = false;
        }
    });
    load();
});
