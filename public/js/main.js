document.addEventListener('DOMContentLoaded', () => {
    const btnTrocar = document.getElementById('btn-trocar');
    const titulo = document.getElementById('titulo');
    const grupoProfissional = document.getElementById('grupo-profissional');
    const grupoResponsavel = document.getElementById('grupo-responsavel');
    const inputCpf = document.getElementById('input-cpf');
    
    let modo = 'profissional';

    btnTrocar.addEventListener('click', (e) => {
        e.preventDefault();
        if (modo === 'profissional') {
            modo = 'responsavel';
            grupoProfissional.classList.add('oculto');
            grupoResponsavel.classList.remove('oculto');
            titulo.textContent = 'Bem-vindo Responsável';
            btnTrocar.textContent = 'Logar como Profissional';
        } else {
            modo = 'profissional';
            grupoResponsavel.classList.add('oculto');
            grupoProfissional.classList.remove('oculto');
            titulo.textContent = 'Bem-vindo Profissional';
            btnTrocar.textContent = 'Logar como Responsável';
        }
    });

    inputCpf.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 3) v = v.replace(/^(\d{3})(\d)/, '$1.$2');
        if (v.length > 6) v = v.replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
        if (v.length > 9) v = v.replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
        e.target.value = v;
    });

});