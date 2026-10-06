-- Dados de exemplo para a demonstração do SGT-TO.
-- Todos os usuários usam a senha 123456 (o valor abaixo é o hash bcrypt dela).
-- Os agendamentos de exemplo são criados pelo src/database/db.js com datas
-- relativas ao dia em que o banco é criado.

INSERT INTO PESSOA (id_pessoa, nome, cpf, senha, telefone) VALUES
    (1, 'Gabriel Tavares', '11111111111', '$2b$10$eoyBu3mOIDh6nqC4HXCh.uBpBsdBlV6/TgmkyWrIui2CC2Be4SgJC', '11999990001'),
    (2, 'Lucas Daniel', '22222222222', '$2b$10$eoyBu3mOIDh6nqC4HXCh.uBpBsdBlV6/TgmkyWrIui2CC2Be4SgJC', '11999990002'),
    (3, 'Mariana Costa', '00000000001', '$2b$10$eoyBu3mOIDh6nqC4HXCh.uBpBsdBlV6/TgmkyWrIui2CC2Be4SgJC', '11999990101'),
    (4, 'Pedro Henrique', '00000000002', '$2b$10$eoyBu3mOIDh6nqC4HXCh.uBpBsdBlV6/TgmkyWrIui2CC2Be4SgJC', '11999990102'),
    (5, 'Julia Santos', '00000000003', '$2b$10$eoyBu3mOIDh6nqC4HXCh.uBpBsdBlV6/TgmkyWrIui2CC2Be4SgJC', '11999990103'),
    (6, 'Lucas Almeida', '00000000004', '$2b$10$eoyBu3mOIDh6nqC4HXCh.uBpBsdBlV6/TgmkyWrIui2CC2Be4SgJC', '11999990104'),
    (7, 'Beatriz Oliveira', '00000000005', '$2b$10$eoyBu3mOIDh6nqC4HXCh.uBpBsdBlV6/TgmkyWrIui2CC2Be4SgJC', '11999990105');

INSERT INTO TERAPEUTA (id_pessoa, especialidade) VALUES
    (1, 'Terapia ocupacional'),
    (2, 'Psicoterapia infantil');

INSERT INTO PACIENTE (id_pessoa, nome_responsavel) VALUES
    (3, 'Carla Costa'),
    (4, 'Roberto Henrique'),
    (5, 'Fernanda Santos'),
    (6, 'Paula Almeida'),
    (7, 'Renato Oliveira');
