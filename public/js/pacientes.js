document.addEventListener('DOMContentLoaded', () => {
    const body = document.getElementById('patients-body');
    const message = document.getElementById('patients-message');
    const modal = document.getElementById('edit-modal');
    const editError = document.getElementById('edit-error');
    const search = document.getElementById('patient-search');
    let patients = [];
    let editing = null;

    function showMessage(text, type = 'error') {
        message.textContent = text;
        message.className = `notice ${type}`;
    }
    function formatCpf(cpf) {
        const digits = String(cpf || '').replace(/\D/g, '');
        return digits.length === 11 ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}` : digits;
    }
    function render() {
        const query = search.value.trim().toLocaleLowerCase('pt-BR');
        const visible = patients.filter((patient) => `${patient.nome} ${patient.cpf} ${patient.telefone} ${patient.nome_responsavel}`.toLocaleLowerCase('pt-BR').includes(query));
        document.getElementById('patient-count').textContent = `${patients.length} ${patients.length === 1 ? 'paciente' : 'pacientes'}`;
        if (!visible.length) {
            body.innerHTML = `<tr><td colspan="5" class="empty-state">${patients.length ? 'Nenhum paciente corresponde à busca.' : 'Ainda não há pacientes cadastrados.'}</td></tr>`;
            return;
        }
        body.innerHTML = visible.map((patient) => `
            <tr>
                <td><span class="person-name">${SGT.escapeHtml(patient.nome)}</span><span class="person-meta">ID ${patient.id_pessoa}</span></td>
                <td>${SGT.escapeHtml(formatCpf(patient.cpf))}</td>
                <td>${SGT.escapeHtml(patient.telefone)}</td>
                <td>${SGT.escapeHtml(patient.nome_responsavel || '—')}</td>
                <td><div class="patient-actions">
                    <a class="icon-button" href="/prontuarios.html?paciente=${patient.id_pessoa}" aria-label="Abrir prontuário de ${SGT.escapeHtml(patient.nome)}" title="Prontuário">≡</a>
                    <button class="icon-button" type="button" data-edit-id="${patient.id_pessoa}" aria-label="Editar ${SGT.escapeHtml(patient.nome)}" title="Editar">✎</button>
                    <button class="icon-button" type="button" data-delete-id="${patient.id_pessoa}" aria-label="Excluir ${SGT.escapeHtml(patient.nome)}" title="Excluir">×</button>
                </div></td>
            </tr>`).join('');
    }
    async function loadPatients() {
        patients = await SGT.api('/api/pacientes');
        render();
    }
    function formPayload(form) {
        const data = new FormData(form);
        const payload = {
            nome: String(data.get('nome') || '').trim(),
            cpf: String(data.get('cpf') || '').replace(/\D/g, ''),
            telefone: String(data.get('telefone') || '').trim(),
            nome_responsavel: String(data.get('nome_responsavel') || '').trim()
        };
        const senha = String(data.get('senha') || '');
        if (senha) payload.senha = senha;
        return payload;
    }
    function openEdit(patient) {
        editing = patient;
        const form = document.getElementById('edit-form');
        form.elements.nome.value = patient.nome;
        form.elements.cpf.value = formatCpf(patient.cpf);
        form.elements.telefone.value = patient.telefone;
        form.elements.nome_responsavel.value = patient.nome_responsavel || '';
        form.elements.senha.value = '';
        editError.classList.add('hidden');
        modal.classList.remove('hidden');
    }
    function closeEdit() {
        modal.classList.add('hidden');
        editing = null;
    }

    document.getElementById('patient-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector('[type="submit"]');
        button.disabled = true;
        try {
            await SGT.api('/api/pacientes', { method: 'POST', body: JSON.stringify(formPayload(form)) });
            form.reset();
            await loadPatients();
            showMessage('Paciente cadastrado com sucesso.', 'success');
        } catch (error) {
            showMessage(error.message);
        } finally {
            button.disabled = false;
        }
    });
    document.getElementById('edit-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!editing) return;
        const button = event.currentTarget.querySelector('[type="submit"]');
        button.disabled = true;
        try {
            await SGT.api(`/api/pacientes/${editing.id_pessoa}`, { method: 'PUT', body: JSON.stringify(formPayload(event.currentTarget)) });
            closeEdit();
            await loadPatients();
            showMessage('Dados do paciente atualizados.', 'success');
        } catch (error) {
            editError.textContent = error.message;
            editError.classList.remove('hidden');
        } finally {
            button.disabled = false;
        }
    });
    body.addEventListener('click', async (event) => {
        const editButton = event.target.closest('[data-edit-id]');
        if (editButton) {
            const patient = patients.find((item) => Number(item.id_pessoa) === Number(editButton.dataset.editId));
            if (patient) openEdit(patient);
            return;
        }
        const deleteButton = event.target.closest('[data-delete-id]');
        if (!deleteButton) return;
        const patient = patients.find((item) => Number(item.id_pessoa) === Number(deleteButton.dataset.deleteId));
        if (!patient || !confirm(`Deseja excluir o cadastro de ${patient.nome}?`)) return;
        deleteButton.disabled = true;
        try {
            await SGT.api(`/api/pacientes/${patient.id_pessoa}`, { method: 'DELETE' });
            await loadPatients();
            showMessage('Paciente removido.', 'success');
        } catch (error) {
            showMessage(error.message);
            deleteButton.disabled = false;
        }
    });
    search.addEventListener('input', render);
    document.getElementById('close-edit').addEventListener('click', closeEdit);
    document.getElementById('cancel-edit').addEventListener('click', closeEdit);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeEdit(); });
    loadPatients().catch((error) => {
        showMessage(error.message);
        body.innerHTML = '<tr><td colspan="5" class="empty-state">Não foi possível carregar os pacientes.</td></tr>';
    });
});
