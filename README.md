# SGT-TO: Sistema de Gestão para Terapia Ocupacional

Sistema web para um consultório de terapia ocupacional: cadastro de pacientes, agenda de atendimentos, controle de status das consultas, prontuário eletrônico e troca de mensagens entre terapeuta e responsável.

Projeto Integrador do curso Técnico em Desenvolvimento de Sistemas (CEEP Curitiba), feito por Gabriel Tavares Nunes Bezerra e Lucas Daniel de Morais Militão.

## Tecnologias

- **Back-end:** Node.js com Express, API em JSON
- **Banco de dados:** SQLite (padrão) ou MySQL
- **Front-end:** HTML, CSS e JavaScript, consumindo a API
- **Segurança:** senhas com bcrypt e token assinado (HMAC) em todas as rotas da API

## Estrutura das pastas

```
SGT-TO/
├── database/              scripts SQL
│   ├── schema.sql         criação das tabelas (SQLite)
│   ├── schema-mysql.sql   criação das tabelas (MySQL)
│   └── dados-exemplo.sql  pessoas, terapeutas e pacientes de exemplo
├── public/                front-end
│   ├── css/               um arquivo de estilo por tela + global.css
│   ├── js/                um script por tela + navbar.js (menu e acesso à API)
│   └── *.html             telas do sistema
├── src/                   back-end (API)
│   ├── database/db.js     conexão com o banco e criação inicial
│   ├── middleware/auth.js geração e verificação do token
│   └── routes/            endpoints da API
└── server.js              inicia o servidor
```

## Como rodar

Requer Node.js 20 ou superior.

```sh
npm install
npm start
```

Abra `http://localhost:3001`. Na primeira execução o banco SQLite é criado em `src/database/sgt-to.sqlite` com os dados de exemplo. Os agendamentos de exemplo usam datas a partir do dia em que o banco foi criado.

Usuários de exemplo (todos com a senha `123456`):

- **Terapeutas:** `gabriel` e `lucas`
- **Responsáveis:** CPF `000.000.000-01` até `000.000.000-05`

Para usar outro arquivo SQLite, defina `DB_PATH`. Para fixar o segredo do token, defina `SESSION_SECRET`. Sem ele, o segredo é gerado na primeira execução e salvo em `.session-secret`, que não vai para o Git.

## MySQL

Crie o banco `sgt_to` (ou o nome definido em `DB_NAME`) e configure:

```text
DB_DRIVER=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua-senha
DB_NAME=sgt_to
```

Ao iniciar, o servidor aplica `database/schema-mysql.sql` e insere os dados de exemplo se a tabela `PESSOA` estiver vazia.

## API

Todas as rotas, menos o login, exigem o cabeçalho `Authorization: Bearer <token>`.

- `POST /api/auth/login`: entra como terapeuta (usuário) ou responsável (CPF).
- `GET /api/pacientes`, `POST /api/pacientes`, `PUT /api/pacientes/:id`, `DELETE /api/pacientes/:id`
- `GET /api/agendamentos?inicio=AAAA-MM-DD&fim=AAAA-MM-DD`, `POST /api/agendamentos`, `PATCH /api/agendamentos/:id/status`
- `GET /api/agendamentos/terapeutas`
- `GET /api/prontuarios/paciente/:id`, `POST /api/prontuarios`
- `GET /api/mensagens/contatos`, `GET /api/mensagens/:idContato`, `POST /api/mensagens`

## Regras do sistema

- O consultório atende de segunda a sexta, das 08:00 às 18:00, com sessões de 50 minutos. O último início possível é 17:10.
- Um terapeuta ou paciente não pode ter dois atendimentos que se sobreponham. Horários cancelados podem ser reaproveitados.
- Toda consulta nasce como "Agendado". O responsável confirma ou cancela pela tela "Minhas consultas" enquanto o horário não chegou, e o terapeuta marca como "Realizado" uma consulta confirmada depois do horário. Uma consulta cancelada não volta a ficar ativa.
- O responsável só vê as consultas e as mensagens do próprio paciente.
- As evoluções do prontuário não podem ser editadas nem apagadas, e pacientes com histórico vinculado não podem ser excluídos.
- O cadastro de paciente aceita uma senha opcional para o acesso do responsável. Sem senha, o responsável só consegue entrar depois que o terapeuta definir uma na edição do paciente.
