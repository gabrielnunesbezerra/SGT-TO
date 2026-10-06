-- Esquema do banco para MySQL (DB_DRIVER=mysql).
-- A versão usada com SQLite fica em schema.sql.

CREATE TABLE IF NOT EXISTS PESSOA (
    id_pessoa INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(160) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    senha VARCHAR(100) NOT NULL,
    telefone VARCHAR(30) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS TERAPEUTA (
    id_pessoa INT PRIMARY KEY,
    especialidade VARCHAR(120) NOT NULL,
    FOREIGN KEY (id_pessoa) REFERENCES PESSOA(id_pessoa) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS PACIENTE (
    id_pessoa INT PRIMARY KEY,
    nome_responsavel VARCHAR(160) NOT NULL DEFAULT '',
    FOREIGN KEY (id_pessoa) REFERENCES PESSOA(id_pessoa) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS AGENDAMENTO (
    id_agendamento INT AUTO_INCREMENT PRIMARY KEY,
    data_agendamento DATE NOT NULL,
    hora_agendamento TIME NOT NULL,
    status ENUM('Agendado', 'Confirmado', 'Realizado', 'Cancelado') NOT NULL DEFAULT 'Agendado',
    id_terapeuta INT NOT NULL,
    id_paciente INT NOT NULL,
    FOREIGN KEY (id_terapeuta) REFERENCES TERAPEUTA(id_pessoa),
    FOREIGN KEY (id_paciente) REFERENCES PACIENTE(id_pessoa),
    INDEX idx_agendamento_data (data_agendamento),
    INDEX idx_agendamento_terapeuta_data (id_terapeuta, data_agendamento)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS PRONTUARIO (
    id_prontuario INT AUTO_INCREMENT PRIMARY KEY,
    data_registro DATE NOT NULL,
    descricao TEXT NOT NULL,
    id_paciente INT NOT NULL,
    id_terapeuta INT NOT NULL,
    FOREIGN KEY (id_paciente) REFERENCES PACIENTE(id_pessoa),
    FOREIGN KEY (id_terapeuta) REFERENCES TERAPEUTA(id_pessoa),
    INDEX idx_prontuario_paciente_data (id_paciente, data_registro)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS MENSAGEM (
    id_mensagem INT AUTO_INCREMENT PRIMARY KEY,
    conteudo TEXT NOT NULL,
    data_envio DATETIME NOT NULL,
    id_terapeuta INT NOT NULL,
    id_paciente INT NOT NULL,
    remetente ENUM('terapeuta', 'paciente') NOT NULL DEFAULT 'paciente',
    FOREIGN KEY (id_terapeuta) REFERENCES TERAPEUTA(id_pessoa),
    FOREIGN KEY (id_paciente) REFERENCES PACIENTE(id_pessoa),
    INDEX idx_mensagem_conversa (id_terapeuta, id_paciente, data_envio)
) ENGINE=InnoDB;
