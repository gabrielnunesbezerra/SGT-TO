document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('record-form');
    const select = document.getElementById('record-patient');
    const submit = form.querySelector('[type="submit"]');
    const list = document.getElementById('records-list');
    const title = document.getElementById('records-title');
    const message = document.getElementById('records-message');
    const hoje = SGT.localDate(new Date());
    let patients = [];

    form.elements.data_registro.value = hoje;
    form.elements.data_registro.max = hoje;

    function showMessage(text, type = 'error') {
        message.textContent = text;
        message.className = `notice ${type}`;
    }
    function selectedPatient() {
        return patients.find((patient) => Number(patient.id_pessoa) === Number(select.value));
    }
    function render(records) {
        if (!records.length) {
            list.innerHTML = '<div class="empty-state">Nenhuma evolução registrada para este paciente.</div>';
            return;
        }
        list.innerHTML = records.map((record) => `
            <article class="record-item">
                <div class="record-meta">
                    <strong>${SGT.escapeHtml(SGT.dateLabel(record.data_registro, { day: '2-digit', month: 'long', year: 'numeric' }))}</strong>
                    <span>${SGT.escapeHtml(record.nome_terapeuta)}</span>
                </div>
                <p>${SGT.escapeHtml(record.descricao)}</p>
            </article>`).join('');
    }
    async function loadRecords() {
        const patient = selectedPatient();
        submit.disabled = !patient;
        if (!patient) {
            title.textContent = 'Histórico';
            list.innerHTML = '<div class="empty-state">Selecione um paciente para ver o histórico.</div>';
            return;
        }
        title.textContent = `Histórico de ${patient.nome}`;
        list.innerHTML = '<div class="loading-state">Carregando evoluções...</div>';
        try {
            render(await SGT.api(`/api/prontuarios/paciente/${patient.id_pessoa}`));
        } catch (error) {
            showMessage(error.message);
            list.innerHTML = '<div class="empty-state">Não foi possível carregar o histórico.</div>';
        }
    }

    select.addEventListener('change', () => {
        message.className = 'notice hidden';
        history.replaceState(null, '', select.value ? `?paciente=${select.value}` : location.pathname);
        loadRecords();
    });
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        submit.disabled = true;
        try {
            await SGT.api('/api/prontuarios', {
                method: 'POST',
                body: JSON.stringify({
                    id_paciente: Number(select.value),
                    data_registro: form.elements.data_registro.value,
                    descricao: form.elements.descricao.value.trim()
                })
            });
            form.elements.descricao.value = '';
            showMessage('Evolução registrada.', 'success');
            await loadRecords();
        } catch (error) {
            showMessage(error.message);
        } finally {
            submit.disabled = !selectedPatient();
        }
    });

    SGT.api('/api/pacientes')
        .then((result) => {
            patients = result;
            select.innerHTML = '<option value="">Selecione um paciente</option>'
                + patients.map((patient) => `<option value="${patient.id_pessoa}">${SGT.escapeHtml(patient.nome)}</option>`).join('');
            const preSelecionado = new URLSearchParams(location.search).get('paciente');
            if (preSelecionado && patients.some((patient) => String(patient.id_pessoa) === preSelecionado)) {
                select.value = preSelecionado;
            }
            return loadRecords();
        })
        .catch((error) => {
            showMessage(error.message);
            select.innerHTML = '<option value="">Não foi possível carregar os pacientes</option>';
        });
});
