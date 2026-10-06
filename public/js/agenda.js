// ===========================================================================
//                         Tela de agenda (agenda.js)
//   Mostra as consultas por dia, semana ou mês e cria novos agendamentos.
// ===========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // -----------------------------------------------------------------------
    //                              Configuração
    // -----------------------------------------------------------------------
    // Expediente do consultório (precisa bater com src/routes/agendamentos.js).
    const HORA_ABERTURA = 8;
    const HORA_FECHAMENTO = 18;
    const DURACAO_MIN = 50;
    const PX_POR_HORA = 70;
    const ULTIMO_INICIO = minutesToTime(HORA_FECHAMENTO * 60 - DURACAO_MIN);
    const ALTURA_CARD = Math.round((DURACAO_MIN / 60) * PX_POR_HORA);
    const DAY_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    // view: 'dia', 'semana' ou 'mes'. focusDate é o dia de referência das três visões.
    const state = { view: 'semana', focusDate: new Date(), month: new Date(), patients: [], therapists: [], appointments: [], upcoming: [] };
    const errorBox = document.getElementById('agenda-message');
    const modal = document.getElementById('appointment-modal');
    const modalError = document.getElementById('modal-error');
    const dateInput = document.getElementById('appointment-date');

    // -----------------------------------------------------------------------
    //                            Funções de data
    // -----------------------------------------------------------------------
    function minutesToTime(total) {
        return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    }
    function mondayOf(date) {
        const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        return monday;
    }
    function addDays(date, days) {
        const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        result.setDate(result.getDate() + days);
        return result;
    }
    function proximoDiaUtil(date, passo = 1) {
        let result = addDays(date, 0);
        while (result.getDay() === 0 || result.getDay() === 6) result = addDays(result, passo);
        return result;
    }
    function itemsOf(dateValue) {
        // Consultas canceladas liberam o horário, então não aparecem na agenda.
        return state.appointments.filter((item) => String(item.data_agendamento).slice(0, 10) === dateValue
            && item.status !== 'Cancelado');
    }
    // Primeiro e último dia carregados da API em cada visão.
    function currentRange() {
        const focus = state.focusDate;
        if (state.view === 'dia') return [focus, focus];
        if (state.view === 'semana') {
            const monday = mondayOf(focus);
            return [monday, addDays(monday, 4)];
        }
        const first = new Date(focus.getFullYear(), focus.getMonth(), 1);
        const last = new Date(focus.getFullYear(), focus.getMonth() + 1, 0);
        return [mondayOf(first), addDays(mondayOf(last), 4)];
    }

    // -----------------------------------------------------------------------
    //                         Mensagens e formulário
    // -----------------------------------------------------------------------
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

    // -----------------------------------------------------------------------
    //                           Desenho da agenda
    //   renderGrid desenha dia e semana. renderMonthBoard desenha o mês.
    // -----------------------------------------------------------------------
    function renderTitle() {
        const [inicio, fim] = currentRange();
        let titulo;
        if (state.view === 'dia') {
            titulo = SGT.dateLabel(SGT.localDate(inicio), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        } else if (state.view === 'semana') {
            titulo = `${SGT.dateLabel(SGT.localDate(inicio), { day: 'numeric', month: 'short' })} – ${SGT.dateLabel(SGT.localDate(fim), { day: 'numeric', month: 'short', year: 'numeric' })}`;
        } else {
            titulo = state.focusDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        }
        document.getElementById('week-title').textContent = titulo.charAt(0).toUpperCase() + titulo.slice(1);
        const nomes = { dia: ['Dia anterior', 'Próximo dia'], semana: ['Semana anterior', 'Próxima semana'], mes: ['Mês anterior', 'Próximo mês'] }[state.view];
        document.getElementById('periodo-anterior').setAttribute('aria-label', nomes[0]);
        document.getElementById('periodo-proximo').setAttribute('aria-label', nomes[1]);
        document.querySelectorAll('[data-view]').forEach((button) => {
            const ativo = button.dataset.view === state.view;
            button.classList.toggle('active', ativo);
            button.setAttribute('aria-pressed', String(ativo));
        });
    }
    // Grade com horários: usada na visão de dia (1 coluna) e de semana (5 colunas).
    function renderGrid(days) {
        const today = SGT.localDate(new Date());
        const board = document.getElementById('week-board');
        board.className = 'week-board';
        board.style.setProperty('--dias', days.length);
        board.innerHTML = `
            <div class="time-column"><div class="time-heading"></div><div class="time-labels">${Array.from({ length: HORA_FECHAMENTO - HORA_ABERTURA + 1 }, (_, i) => `<span style="top:${i * PX_POR_HORA}px">${String(i + HORA_ABERTURA).padStart(2, '0')}:00</span>`).join('')}</div></div>
            ${days.map((date) => {
                const dateValue = SGT.localDate(date);
                const clicavel = state.view === 'semana';
                return `<div class="day-column">
                    <div class="day-heading ${dateValue === today ? 'today' : ''} ${clicavel ? 'clickable' : ''}" ${clicavel ? `data-open-day="${dateValue}" title="Ver este dia"` : ''}><span>${DAY_FULL[date.getDay()].slice(0, 3)}</span><strong>${date.getDate()}</strong></div>
                    <div class="appointment-lane">
                        ${itemsOf(dateValue).map((item) => {
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
    }
    // Visão mensal: só dias úteis, cada dia mostra até 3 consultas e abre a visão do dia ao clicar.
    function renderMonthBoard() {
        const today = SGT.localDate(new Date());
        const [inicio, fim] = currentRange();
        const mes = state.focusDate.getMonth();
        const cells = [];
        for (let date = inicio; date <= fim; date = addDays(date, 1)) {
            if (date.getDay() === 0 || date.getDay() === 6) continue;
            const dateValue = SGT.localDate(date);
            const items = itemsOf(dateValue);
            cells.push(`<button type="button" class="month-cell ${date.getMonth() !== mes ? 'outside' : ''} ${dateValue === today ? 'today' : ''}" data-open-day="${dateValue}" aria-label="${date.toLocaleDateString('pt-BR')}: ${items.length} consulta(s)">
                <span class="month-day">${date.getDate()}</span>
                ${items.slice(0, 3).map((item) => `<span class="month-item status-${SGT.escapeHtml(item.status.toLowerCase())}">${SGT.escapeHtml(String(item.hora_agendamento).slice(0, 5))} ${SGT.escapeHtml(item.nome_paciente)}</span>`).join('')}
                ${items.length > 3 ? `<span class="month-more">+ ${items.length - 3} consulta(s)</span>` : ''}
            </button>`);
        }
        const board = document.getElementById('week-board');
        board.className = 'month-board';
        board.style.removeProperty('--dias');
        board.innerHTML = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].map((dia) => `<div class="month-weekday">${dia}</div>`).join('') + cells.join('');
    }
    function render() {
        renderTitle();
        if (state.view === 'mes') {
            renderMonthBoard();
        } else {
            const [inicio] = currentRange();
            renderGrid(state.view === 'dia' ? [inicio] : Array.from({ length: 5 }, (_, i) => addDays(inicio, i)));
        }
        state.month = new Date(state.focusDate.getFullYear(), state.focusDate.getMonth(), 1);
        renderMonth();
    }

    // -----------------------------------------------------------------------
    //                     Calendário pequeno da lateral
    // -----------------------------------------------------------------------
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

    // -----------------------------------------------------------------------
    //                            Lista de espera
    // -----------------------------------------------------------------------
    function renderWaitingList() {
        const futurePatientIds = new Set(state.upcoming
            .filter((item) => item.status !== 'Cancelado')
            .map((item) => Number(item.id_paciente)));
        const waiting = state.patients.filter((patient) => !futurePatientIds.has(Number(patient.id_pessoa)));
        document.getElementById('waiting-count').textContent = waiting.length;
        document.getElementById('waiting-list').innerHTML = waiting.length
            ? waiting.slice(0, 5).map((patient) => `<div class="waiting-person">${SGT.escapeHtml(patient.nome)}<span>${SGT.escapeHtml(patient.telefone || 'Sem telefone cadastrado')}</span></div>`).join('')
            : '<div class="empty-state">Todos os pacientes têm horário futuro.</div>';
    }

    // -----------------------------------------------------------------------
    //                         Carregamento dos dados
    // -----------------------------------------------------------------------
    const currentUser = SGT.usuario;
    async function loadAgenda() {
        if (state.view === 'dia') state.focusDate = proximoDiaUtil(state.focusDate);
        try {
            const [inicio, fim] = currentRange();
            const params = new URLSearchParams({ inicio: SGT.localDate(inicio), fim: SGT.localDate(fim) });
            if (currentUser && currentUser.tipo === 'terapeuta') {
                params.set('id_terapeuta', String(currentUser.id));
            }
            state.appointments = await SGT.api(`/api/agendamentos?${params.toString()}`);
            render();
            errorBox.className = 'notice hidden';
        } catch (error) {
            showError(error);
        }
    }
    // A lista de espera olha todas as consultas a partir de hoje, não só a semana aberta na tela.
    async function loadWaitingList() {
        state.upcoming = await SGT.api(`/api/agendamentos?inicio=${SGT.localDate(new Date())}`);
        renderWaitingList();
    }

    // -----------------------------------------------------------------------
    //                       Janela de novo agendamento
    // -----------------------------------------------------------------------
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

    // -----------------------------------------------------------------------
    //                               Navegação
    //   Setas, botão Hoje, troca de visão e cliques nos dias.
    // -----------------------------------------------------------------------
    function move(direcao) {
        const focus = state.focusDate;
        if (state.view === 'dia') {
            state.focusDate = proximoDiaUtil(addDays(focus, direcao), direcao);
        } else if (state.view === 'semana') {
            state.focusDate = addDays(focus, 7 * direcao);
        } else {
            state.focusDate = new Date(focus.getFullYear(), focus.getMonth() + direcao, 1);
        }
        loadAgenda();
    }
    function openDay(dateValue) {
        state.view = 'dia';
        state.focusDate = new Date(`${dateValue}T12:00:00`);
        loadAgenda();
    }
    document.getElementById('periodo-anterior').addEventListener('click', () => move(-1));
    document.getElementById('periodo-proximo').addEventListener('click', () => move(1));
    document.getElementById('periodo-hoje').addEventListener('click', () => {
        state.focusDate = new Date();
        loadAgenda();
    });
    document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
        if (state.view === button.dataset.view) return;
        state.view = button.dataset.view;
        loadAgenda();
    }));
    document.getElementById('week-board').addEventListener('click', (event) => {
        const target = event.target.closest('[data-open-day]');
        if (target) openDay(target.dataset.openDay);
    });
    document.getElementById('mes-anterior').addEventListener('click', () => { state.month.setMonth(state.month.getMonth() - 1); renderMonth(); });
    document.getElementById('mes-proximo').addEventListener('click', () => { state.month.setMonth(state.month.getMonth() + 1); renderMonth(); });
    document.getElementById('mini-grid').addEventListener('click', (event) => {
        const button = event.target.closest('[data-calendar-date]');
        if (!button) return;
        state.focusDate = new Date(`${button.dataset.calendarDate}T12:00:00`);
        loadAgenda();
    });

    // -----------------------------------------------------------------------
    //                         Eventos do formulário
    // -----------------------------------------------------------------------
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
            await Promise.all([loadAgenda(), loadWaitingList()]);
        } catch (error) {
            showModalError(error.message);
        } finally {
            button.disabled = false;
        }
    });

    // -----------------------------------------------------------------------
    //                                 Início
    //   Carrega pacientes e terapeutas e depois a agenda.
    // -----------------------------------------------------------------------
    Promise.all([SGT.api('/api/pacientes'), SGT.api('/api/agendamentos/terapeutas')])
        .then(([patients, therapists]) => {
            state.patients = patients;
            state.therapists = therapists;
            document.getElementById('appointment-patient').innerHTML = '<option value="">Selecione um paciente</option>'
                + patients.map((patient) => `<option value="${patient.id_pessoa}">${SGT.escapeHtml(patient.nome)}</option>`).join('');
            document.getElementById('appointment-therapist').innerHTML = '<option value="">Selecione um terapeuta</option>'
                + therapists.map((therapist) => `<option value="${therapist.id_pessoa}">${SGT.escapeHtml(therapist.nome)} · ${SGT.escapeHtml(therapist.especialidade)}</option>`).join('');
            if (currentUser && therapists.some((therapist) => Number(therapist.id_pessoa) === Number(currentUser.id))) {
                document.getElementById('appointment-therapist').value = String(currentUser.id);
            }
            return Promise.all([loadAgenda(), loadWaitingList()]);
        })
        .catch(showError);
});
