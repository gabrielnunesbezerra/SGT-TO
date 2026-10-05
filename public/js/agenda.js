document.addEventListener('DOMContentLoaded', () => {
    const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
    // Expediente do consultório (precisa bater com src/routes/agendamentos.js).
    const HORA_ABERTURA = 8;
    const HORA_FECHAMENTO = 18;
    const DURACAO_MIN = 50;
    const PX_POR_HORA = 70;
    const ULTIMO_INICIO = minutesToTime(HORA_FECHAMENTO * 60 - DURACAO_MIN);
    const ALTURA_CARD = Math.round((DURACAO_MIN / 60) * PX_POR_HORA);
    const state = { weekStart: mondayOf(new Date()), focusDate: new Date(), month: new Date(), patients: [], therapists: [], appointments: [] };
    const errorBox = document.getElementById('agenda-message');
    const modal = document.getElementById('appointment-modal');
    const modalError = document.getElementById('modal-error');
    const dateInput = document.getElementById('appointment-date');

    function minutesToTime(total) {
        return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    }
    function mondayOf(date) {
        const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        return monday;
    }
    function weekDate(index) {
        const date = new Date(state.weekStart);
        date.setDate(date.getDate() + index);
        return date;
    }
    function proximoDiaUtil(date) {
        const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        while (result.getDay() === 0 || result.getDay() === 6) result.setDate(result.getDate() + 1);
        return result;
    }
    function updateDateLabel() {
        const texto = dateInput.value
            ? SGT.dateLabel(dateInput.value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            : 'Selecione a data';
        document.getElementById('appointment-day-label').textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
    }
    function showModalError(text) {
        modalError.textContent = text;
        modalError.classList.remove('hidden');
    }
    function showError(error) {
        errorBox.textContent = error.message;
        errorBox.className = 'notice error';
    }
    function updateEndTime() {
        const [hours, minutes] = document.getElementById('appointment-time').value.split(':').map(Number);
        if (Number.isNaN(hours)) return;
        document.getElementById('appointment-end').textContent = minutesToTime((hours * 60 + minutes + DURACAO_MIN) % (24 * 60));
    }
    function renderWeek() {
        const end = weekDate(4);
        document.getElementById('week-title').textContent = `${SGT.dateLabel(SGT.localDate(state.weekStart), { day: 'numeric', month: 'short' })} – ${SGT.dateLabel(SGT.localDate(end), { day: 'numeric', month: 'short', year: 'numeric' })}`;
        const today = SGT.localDate(new Date());
        document.getElementById('week-board').innerHTML = `
            <div class="time-column"><div class="time-heading"></div><div class="time-labels">${Array.from({ length: HORA_FECHAMENTO - HORA_ABERTURA + 1 }, (_, i) => `<span style="top:${i * PX_POR_HORA}px">${String(i + HORA_ABERTURA).padStart(2, '0')}:00</span>`).join('')}</div></div>
            ${DAY_NAMES.map((name, index) => {
                const date = weekDate(index);
                const dateValue = SGT.localDate(date);
                const dayItems = state.appointments.filter((item) => String(item.data_agendamento).slice(0, 10) === dateValue);
                return `<div class="day-column">
                    <div class="day-heading ${dateValue === today ? 'today' : ''}"><span>${name}</span><strong>${date.getDate()}</strong></div>
                    <div class="appointment-lane">
                        ${dayItems.map((item) => {
                            const [hour, minute] = String(item.hora_agendamento).slice(0, 5).split(':').map(Number);
                            const alturaMaxima = (HORA_FECHAMENTO - HORA_ABERTURA) * PX_POR_HORA - ALTURA_CARD;
                            const top = Math.min(alturaMaxima, Math.max(0, ((hour * 60 + minute - HORA_ABERTURA * 60) / 60) * PX_POR_HORA));
                            return `<article class="appointment-card status-${SGT.escapeHtml(item.status.toLowerCase())}" style="top:${top}px;height:${ALTURA_CARD}px" title="${SGT.escapeHtml(item.nome_paciente)} · ${SGT.escapeHtml(item.nome_terapeuta)}">
                                <strong>${SGT.escapeHtml(String(item.hora_agendamento).slice(0, 5))} · ${SGT.escapeHtml(item.nome_paciente)}</strong>
                                <span>${SGT.escapeHtml(item.nome_terapeuta)} · ${SGT.escapeHtml(item.status)}</span>
                            </article>`;
                        }).join('')}
                    </div>
                </div>`;
            }).join('')}`;
        state.month = new Date(state.focusDate.getFullYear(), state.focusDate.getMonth(), 1);
        renderMonth();
    }
    function renderMonth() {
        const month = state.month;
        document.getElementById('mini-month-label').textContent = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
        const start = new Date(month.getFullYear(), month.getMonth(), 1 - offset);
        const selectedDate = SGT.localDate(state.focusDate);
        const weekdays = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
        document.getElementById('mini-grid').innerHTML = weekdays.map((day) => `<span>${day}</span>`).join('')
            + Array.from({ length: 42 }, (_, index) => {
                const date = new Date(start);
                date.setDate(start.getDate() + index);
                const value = SGT.localDate(date);
                return `<button type="button" class="${date.getMonth() !== month.getMonth() ? 'outside' : ''} ${value === selectedDate ? 'selected' : ''}" data-calendar-date="${value}" aria-label="${date.toLocaleDateString('pt-BR')}">${date.getDate()}</button>`;
            }).join('');
    }
    function renderWaitingList() {
        const futurePatientIds = new Set(state.appointments
            .filter((item) => String(item.data_agendamento).slice(0, 10) >= SGT.localDate(new Date()) && item.status !== 'Cancelado')
            .map((item) => Number(item.id_paciente)));
        const waiting = state.patients.filter((patient) => !futurePatientIds.has(Number(patient.id_pessoa))).slice(0, 5);
        document.getElementById('waiting-count').textContent = waiting.length;
        document.getElementById('waiting-list').innerHTML = waiting.length
            ? waiting.map((patient) => `<div class="waiting-person">${SGT.escapeHtml(patient.nome)}<span>${SGT.escapeHtml(patient.telefone || 'Sem telefone cadastrado')}</span></div>`).join('')
            : '<div class="empty-state">Todos os pacientes têm horário futuro.</div>';
    }
    const currentUser = (() => {
        try {
            return JSON.parse(sessionStorage.getItem('sgt-usuario') || 'null');
        } catch (error) {
            return null;
        }
    })();
    async function loadWeek() {
        try {
            const inicio = SGT.localDate(state.weekStart);
            const fim = SGT.localDate(weekDate(4));
            const params = new URLSearchParams({ inicio, fim });
            if (currentUser && currentUser.tipo === 'terapeuta') {
                params.set('id_terapeuta', String(currentUser.id));
            }
            state.appointments = await SGT.api(`/api/agendamentos?${params.toString()}`);
            renderWeek();
            renderWaitingList();
            errorBox.className = 'notice hidden';
        } catch (error) {
            showError(error);
        }
    }
    function openModal() {
        modal.classList.remove('hidden');
        modalError.classList.add('hidden');
        const hoje = SGT.localDate(new Date());
        const agora = new Date();
        let base = SGT.localDate(state.focusDate) < hoje ? agora : state.focusDate;
        // Depois do último horário do dia, sugere o próximo dia útil.
        if (SGT.localDate(base) === hoje && agora.toTimeString().slice(0, 5) > ULTIMO_INICIO) {
            base = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
        }
        dateInput.min = hoje;
        dateInput.value = SGT.localDate(proximoDiaUtil(base));
        updateDateLabel();
        updateEndTime();
    }
    function closeModal() {
        modal.classList.add('hidden');
    }

    document.getElementById('semana-anterior').addEventListener('click', () => {
        state.weekStart.setDate(state.weekStart.getDate() - 7);
        state.focusDate = weekDate(2);
        loadWeek();
    });
    document.getElementById('semana-proxima').addEventListener('click', () => {
        state.weekStart.setDate(state.weekStart.getDate() + 7);
        state.focusDate = weekDate(2);
        loadWeek();
    });
    document.getElementById('semana-atual').addEventListener('click', () => {
        state.focusDate = new Date();
        state.weekStart = mondayOf(state.focusDate);
        loadWeek();
    });
    document.getElementById('mes-anterior').addEventListener('click', () => { state.month.setMonth(state.month.getMonth() - 1); renderMonth(); });
    document.getElementById('mes-proximo').addEventListener('click', () => { state.month.setMonth(state.month.getMonth() + 1); renderMonth(); });
    document.getElementById('mini-grid').addEventListener('click', (event) => {
        const button = event.target.closest('[data-calendar-date]');
        if (!button) return;
        state.focusDate = new Date(`${button.dataset.calendarDate}T12:00:00`);
        state.weekStart = mondayOf(state.focusDate);
        loadWeek();
    });
    document.getElementById('novo-agendamento').addEventListener('click', openModal);
    document.getElementById('fechar-modal').addEventListener('click', closeModal);
    document.getElementById('cancelar-modal').addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    document.getElementById('appointment-time').addEventListener('input', updateEndTime);
    dateInput.addEventListener('input', updateDateLabel);
    document.getElementById('appointment-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = event.currentTarget.querySelector('[type="submit"]');
        modalError.classList.add('hidden');
        const data = dateInput.value;
        const diaSemana = new Date(`${data}T12:00:00`).getDay();
        if (diaSemana === 0 || diaSemana === 6) {
            showModalError('O consultório atende de segunda a sexta.');
            return;
        }
        const hora = document.getElementById('appointment-time').value;
        if (hora < minutesToTime(HORA_ABERTURA * 60) || hora > ULTIMO_INICIO) {
            showModalError(`Escolha um início entre ${minutesToTime(HORA_ABERTURA * 60)} e ${ULTIMO_INICIO}. O consultório fecha às ${minutesToTime(HORA_FECHAMENTO * 60)}.`);
            return;
        }
        button.disabled = true;
        try {
            await SGT.api('/api/agendamentos', {
                method: 'POST',
                body: JSON.stringify({
                    data_agendamento: data,
                    hora_agendamento: hora,
                    id_paciente: Number(document.getElementById('appointment-patient').value),
                    id_terapeuta: Number(document.getElementById('appointment-therapist').value)
                })
            });
            closeModal();
            state.focusDate = new Date(`${data}T12:00:00`);
            state.weekStart = mondayOf(state.focusDate);
            await loadWeek();
        } catch (error) {
            showModalError(error.message);
        } finally {
            button.disabled = false;
        }
    });

    Promise.all([SGT.api('/api/pacientes'), SGT.api('/api/agendamentos/terapeutas')])
        .then(([patients, therapists]) => {
            state.patients = patients;
            state.therapists = therapists;
            document.getElementById('appointment-patient').innerHTML = '<option value="">Selecione um paciente</option>'
                + patients.map((patient) => `<option value="${patient.id_pessoa}">${SGT.escapeHtml(patient.nome)}</option>`).join('');
            document.getElementById('appointment-therapist').innerHTML = '<option value="">Selecione um terapeuta</option>'
                + therapists.map((therapist) => `<option value="${therapist.id_pessoa}">${SGT.escapeHtml(therapist.nome)} · ${SGT.escapeHtml(therapist.especialidade)}</option>`).join('');
            return loadWeek();
        })
        .catch(showError);
});
