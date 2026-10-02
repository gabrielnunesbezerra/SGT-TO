document.addEventListener('DOMContentLoaded', async () => {
    const message = document.getElementById('dashboard-message');
    const showError = (error) => {
        message.textContent = error.message;
        message.className = 'notice error';
    };
    try {
        const [pacientes, agendamentos] = await Promise.all([
            SGT.api('/api/pacientes'),
            SGT.api('/api/agendamentos')
        ]);
        const hoje = SGT.localDate(new Date());
        const deHoje = agendamentos.filter((item) => String(item.data_agendamento).slice(0, 10) === hoje)
            .sort((a, b) => String(a.hora_agendamento).localeCompare(String(b.hora_agendamento)));
        document.getElementById('total-pacientes').textContent = pacientes.length;
        document.getElementById('consultas-hoje').textContent = deHoje.length;
        const agora = new Date().toTimeString().slice(0, 5);
        const proximos = agendamentos.filter((item) => {
            const date = String(item.data_agendamento).slice(0, 10);
            return item.status !== 'Cancelado' && (date > hoje || (date === hoje && String(item.hora_agendamento).slice(0, 5) >= agora));
        }).sort((a, b) => `${a.data_agendamento}`.localeCompare(`${b.data_agendamento}`) || String(a.hora_agendamento).localeCompare(String(b.hora_agendamento)));
        const proximo = proximos[0];
        document.getElementById('proximo-horario').textContent = proximo
            ? `${String(proximo.hora_agendamento).slice(0, 5)}${String(proximo.data_agendamento).slice(0, 10) === hoje ? '' : ` · ${SGT.dateLabel(proximo.data_agendamento)}`}`
            : '—';
        document.getElementById('proximo-paciente').textContent = proximo ? proximo.nome_paciente : 'Sem atendimentos próximos';
        const list = document.getElementById('agenda-hoje');
        if (!deHoje.length) {
            list.innerHTML = '<div class="empty-state">Nenhuma consulta marcada para hoje.</div>';
            return;
        }
        list.innerHTML = deHoje.map((item) => `
            <div class="today-item">
                <span class="today-time">${SGT.escapeHtml(String(item.hora_agendamento).slice(0, 5))}</span>
                <div><span class="today-person">${SGT.escapeHtml(item.nome_paciente)}</span><span class="today-detail">com ${SGT.escapeHtml(item.nome_terapeuta)}</span></div>
                <span class="badge ${SGT.escapeHtml(item.status.toLowerCase())}">${SGT.escapeHtml(item.status)}</span>
            </div>`).join('');
    } catch (error) {
        showError(error);
        document.getElementById('agenda-hoje').innerHTML = '<div class="empty-state">Não foi possível carregar a agenda.</div>';
    }
});
