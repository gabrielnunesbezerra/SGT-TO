document.addEventListener('DOMContentLoaded', () => {
    const btnTrocar = document.getElementById('btn-trocar');
    const titulo = document.getElementById('titulo');
    const grupoProfissional = document.getElementById('grupo-profissional');
    const grupoResponsavel = document.getElementById('grupo-responsavel');
    const inputUsuario = document.getElementById('input-usuario');
    const inputCpf = document.getElementById('input-cpf');
    const inputSenha = document.getElementById('input-senha');
    const form = document.getElementById('form-login');
    const message = document.getElementById('login-message');
    let modo = 'profissional';

    const aviso = sessionStorage.getItem('sgt-aviso');
    if (aviso) {
        sessionStorage.removeItem('sgt-aviso');
        message.textContent = aviso;
        message.classList.remove('oculto');
    }

    btnTrocar.addEventListener('click', (e) => {
        e.preventDefault();
        message.classList.add('oculto');
        if (modo === 'profissional') {
            modo = 'responsavel';
            grupoProfissional.classList.add('oculto');
            grupoResponsavel.classList.remove('oculto');
            inputUsuario.required = false;
            inputUsuario.disabled = true;
            inputCpf.required = true;
            inputCpf.disabled = false;
            titulo.textContent = 'Bem-vindo Responsável';
            btnTrocar.textContent = 'Logar como Profissional';
        } else {
            modo = 'profissional';
            grupoResponsavel.classList.add('oculto');
            grupoProfissional.classList.remove('oculto');
            inputCpf.required = false;
            inputCpf.disabled = true;
            inputUsuario.required = true;
            inputUsuario.disabled = false;
            titulo.textContent = 'Bem-vindo Profissional';
            btnTrocar.textContent = 'Logar como Responsável';
        }
    });

    inputCpf.addEventListener('input', (event) => {
        let value = event.target.value.replace(/\D/g, '').slice(0, 11);
        if (value.length > 9) value = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2})$/, '$1.$2.$3-$4');
        else if (value.length > 6) value = value.replace(/^(\d{3})(\d{3})(\d{1,3})$/, '$1.$2.$3');
        else if (value.length > 3) value = value.replace(/^(\d{3})(\d{1,3})$/, '$1.$2');
        event.target.value = value;
    });

    inputUsuario.addEventListener('input', (event) => {
        event.target.value = event.target.value.trimStart().replace(/\s{2,}/g, ' ');
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = form.querySelector('[type="submit"]');
        const identificador = modo === 'profissional' ? inputUsuario.value.trim() : inputCpf.value;
        button.disabled = true;
        message.classList.add('oculto');
        try {
            const payload = {
                tipo: modo === 'profissional' ? 'terapeuta' : 'paciente',
                senha: inputSenha.value
            };
            if (modo === 'profissional') payload.login = identificador;
            else payload.cpf = identificador;
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.erro || 'Não foi possível entrar.');
            sessionStorage.setItem('sgt-usuario', JSON.stringify(result.usuario));
            sessionStorage.setItem('sgt-token', result.token);
            window.location.href = result.usuario.tipo === 'paciente' ? '/consultas.html' : '/painel.html';
        } catch (error) {
            message.textContent = error.message;
            message.classList.remove('oculto');
        } finally {
            button.disabled = false;
        }
    });
});