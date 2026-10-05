# SGT-O — Sistema de Gestão para Terapia Ocupacional

Aplicação web com Express, telas modulares em HTML/CSS/JavaScript e persistência relacional em SQLite ou MySQL.

## Executar localmente

Requer Node.js 20 ou superior.

```sh
npm install
npm start
```

Abra `http://localhost:3001`. Na primeira execução o banco SQLite é criado em `src/database/sgt-to.sqlite` e recebe dados demonstrativos. Os usuários demonstrativos usam a senha `123456`; terapeutas de exemplo: Gabriel Tavares (`gabriel` ou `gabrieltavares`) e Lucas Daniel (`lucas` ou `lucasdaniel`). Pacientes de exemplo: CPF de `00000000001` a `00000000005`.

Para escolher outro local para o SQLite, defina `DB_PATH`. O banco padrão é local e não deve ser publicado.

## MySQL

Crie previamente o banco `sgt_to` (ou o definido por `DB_NAME`) e configure:

```text
DB_DRIVER=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua-senha
DB_NAME=sgt_to
```

O inicializador aplica o esquema compatível com MySQL e insere a mesma carga demonstrativa quando `PESSOA` ainda está vazia.

## API

- `POST /api/auth/login`: autentica terapeuta ou paciente usando CPF e senha.
- `GET /api/pacientes`, `POST /api/pacientes`, `PUT /api/pacientes/:id`, `DELETE /api/pacientes/:id`.
- `GET /api/agendamentos?inicio=AAAA-MM-DD&fim=AAAA-MM-DD`, `POST /api/agendamentos`, `PATCH /api/agendamentos/:id/status`.
- `GET /api/agendamentos/terapeutas`: lista terapeutas para o formulário de agenda.
- `GET /api/prontuarios/paciente/:id`, `POST /api/prontuarios`.

Agendamentos são serializados por terapeuta durante a criação para impedir reservas simultâneas do mesmo horário; horários cancelados podem ser reservados novamente. Evoluções de prontuário são somente de inclusão; pacientes com registros vinculados não podem ser excluídos para preservar o histórico clínico.

O formulário de cadastro de pacientes permite definir uma senha opcional para acesso do próprio paciente. Se não for informada, uma senha aleatória é armazenada em hash e o paciente não poderá entrar até que uma senha seja definida por um fluxo administrativo.
