-- ===========================================================================
--                        Criação das tabelas (SQLite)
--   Roda toda vez que o servidor inicia. O IF NOT EXISTS evita apagar dados.
-- ===========================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
--                               Tabela PESSOA
--   Dados comuns a terapeutas e pacientes: nome, CPF, senha e telefone.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS PESSOA (
    id_pessoa INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cpf TEXT NOT NULL UNIQUE,
    senha TEXT NOT NULL,
    telefone TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
--                              Tabela TERAPEUTA
--   Pessoa que atende, com a especialidade.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS TERAPEUTA (
    id_pessoa INTEGER PRIMARY KEY,
    especialidade TEXT NOT NULL,
    FOREIGN KEY (id_pessoa) REFERENCES PESSOA(id_pessoa) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
--                              Tabela PACIENTE
--   Pessoa atendida, com o nome do responsável.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS PACIENTE (
    id_pessoa INTEGER PRIMARY KEY,
    nome_responsavel TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (id_pessoa) REFERENCES PESSOA(id_pessoa) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
--                             Tabela AGENDAMENTO
--   Consultas marcadas e o status de cada uma.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS AGENDAMENTO (
    id_agendamento INTEGER PRIMARY KEY AUTOINCREMENT,
    data_agendamento TEXT NOT NULL,
    hora_agendamento TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Agendado'
        CHECK (status IN ('Agendado', 'Confirmado', 'Realizado', 'Cancelado')),
    id_terapeuta INTEGER NOT NULL,
    id_paciente INTEGER NOT NULL,
    FOREIGN KEY (id_terapeuta) REFERENCES TERAPEUTA(id_pessoa),
    FOREIGN KEY (id_paciente) REFERENCES PACIENTE(id_pessoa)
);

-- ---------------------------------------------------------------------------
--                             Tabela PRONTUARIO
--   Evoluções clínicas registradas pelo terapeuta.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS PRONTUARIO (
    id_prontuario INTEGER PRIMARY KEY AUTOINCREMENT,
    data_registro TEXT NOT NULL,
    descricao TEXT NOT NULL,
    id_paciente INTEGER NOT NULL,
    id_terapeuta INTEGER NOT NULL,
    FOREIGN KEY (id_paciente) REFERENCES PACIENTE(id_pessoa),
    FOREIGN KEY (id_terapeuta) REFERENCES TERAPEUTA(id_pessoa)
);

-- ---------------------------------------------------------------------------
--                              Tabela MENSAGEM
--   Conversa entre terapeuta e responsável.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS MENSAGEM (
    id_mensagem INTEGER PRIMARY KEY AUTOINCREMENT,
    conteudo TEXT NOT NULL,
    data_envio TEXT NOT NULL,
    id_terapeuta INTEGER NOT NULL,
    id_paciente INTEGER NOT NULL,
    remetente TEXT NOT NULL DEFAULT 'paciente'
        CHECK (remetente IN ('terapeuta', 'paciente')),
    FOREIGN KEY (id_terapeuta) REFERENCES TERAPEUTA(id_pessoa),
    FOREIGN KEY (id_paciente) REFERENCES PACIENTE(id_pessoa)
);

-- ---------------------------------------------------------------------------
--                                  Índices
--   Deixam mais rápidas as buscas por data, terapeuta e paciente.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_agendamento_data ON AGENDAMENTO(data_agendamento);
CREATE INDEX IF NOT EXISTS idx_agendamento_terapeuta_data ON AGENDAMENTO(id_terapeuta, data_agendamento);
CREATE INDEX IF NOT EXISTS idx_prontuario_paciente_data ON PRONTUARIO(id_paciente, data_registro);
CREATE INDEX IF NOT EXISTS idx_mensagem_conversa ON MENSAGEM(id_terapeuta, id_paciente, data_envio);
