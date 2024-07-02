const express = require("express");
const app = express();
const mySql = require('./db.js');

app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");

// Servindo arquivos estáticos da pasta 'public'
app.use(express.static('public'));

// (1) Consulta todos registros
app.get("/home", function (req, res) {
    const sql = "SELECT Filme.*, Genero.Nome AS Genero FROM Filme JOIN Genero ON Filme.FK_Genero = Genero.Id LEFT JOIN Aluguel ON Filme.Id = Aluguel.FK_Filme AND Aluguel.Vigente = true WHERE Aluguel.Id IS NULL OR Aluguel.Vigente = false";
    mySql.query(sql, [], function (err, rows) {
        if (err) {
            console.error("Erro no retorno da SELECT...", err);
            return res.status(500).send("Erro ao consultar o banco de dados.");
        }
        res.render("home", { dados: rows });
    });
});

const bcrypt = require('bcrypt');

// Rota GET para exibir o formulário de cadastro e login
app.get("/", (req, res) => {
    res.render("login");
});

// Rota POST para processar o cadastro do cliente
app.post("/cadastro", async (req, res) => {
    const { email, telefone, pais, estado, logradouro, cep, username, password, nome } = req.body;

    try {
        mySql.beginTransaction(err => {
            if (err) {
                return res.status(500).send("Erro ao iniciar a transação.");
            }

            // Inserir na tabela Contato
            const contatoQuery = "INSERT INTO Contato (Email, Telefone) VALUES (?, ?)";
            mySql.query(contatoQuery, [email, telefone], (err, contatoResult) => {
                if (err) {
                    return mySql.rollback(() => {
                        res.status(500).send("Erro ao inserir na tabela Contato.");
                    });
                }

                const contatoId = contatoResult.insertId;

                // Inserir na tabela Endereco
                const enderecoQuery = "INSERT INTO Endereco (Logradouro, FK_Estado, FK_Pais, CEP) VALUES (?, ?, ?, ?)";
                mySql.query(enderecoQuery, [logradouro, estado, pais, cep], (err, enderecoResult) => {
                    if (err) {
                        return mySql.rollback(() => {
                            res.status(500).send("Erro ao inserir na tabela Endereco.");
                        });
                    }

                    const enderecoId = enderecoResult.insertId;

                    // Inserir na tabela Usuario
                    const usuarioQuery = "INSERT INTO Usuario (Username, Password) VALUES (?, ?)";
                    mySql.query(usuarioQuery, [username, password], (err, usuarioResult) => {
                        if (err) {
                            return mySql.rollback(() => {
                                res.status(500).send("Erro ao inserir na tabela Usuario.");
                            });
                        }

                        const usuarioId = usuarioResult.insertId;

                        // Inserir na tabela Cliente
                        const clienteQuery = "INSERT INTO Cliente (Nome, FK_Endereco, FK_Contato, UsuarioId) VALUES (?, ?, ?, ?)";
                        mySql.query(clienteQuery, [nome, enderecoId, contatoId, usuarioId], (err, clienteResult) => {
                            if (err) {
                                return mySql.rollback(() => {
                                    res.status(500).send("Erro ao inserir na tabela Cliente.");
                                });
                            }

                            mySql.commit(err => {
                                if (err) {
                                    return mySql.rollback(() => {
                                        res.status(500).send("Erro ao fazer commit da transação.");
                                    });
                                }
                                
                                // Envie uma resposta de sucesso para o AJAX
                                res.json({ message: "Cadastro realizado com sucesso!" });
                            });
                        });
                    });
                });
            });
        });
    } catch (error) {
        res.status(500).send("Erro ao processar o cadastro.");
    }
});

// Rota POST para processar o login do cliente
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    const query = "SELECT Id, Username FROM Usuario WHERE Username = ? AND Password = ?";
    mySql.query(query, [username, password], (err, results) => {
        if (err) {
            return res.status(500).send("Erro ao consultar o banco de dados.");
        }
        if (results.length === 0) {
            return res.status(401).send("Nome de usuário ou senha incorretos.");
        }

        const user = results[0];
        res.json({
            success: true,
            userId: user.Id,
            username: user.Username
        });
    });
});

app.get("/search", (req, res) => {
    const sql = "SELECT Filme.*, Genero.Nome AS Genero FROM Filme JOIN Genero ON Filme.FK_Genero = Genero.Id";
    mySql.query(sql, [], function (err, rows) {
        if (err) {
            console.error("Erro no retorno da SELECT...", err);
            return res.status(500).send("Erro ao consultar o banco de dados.");
        }
        res.render("search", { dados: rows });
    });
});

app.get("/admin", (req, res) => {
    res.render("admin");
});

// Rota GET para buscar filmes com base nos filtros
app.get('/search2', (req, res) => {
    const searchTerm = req.query.searchTerm || ''; // termo de pesquisa, opcional
    const minDuration = req.query.minDuration || 0; // duração mínima, opcional
    const maxDuration = req.query.maxDuration || 999; // duração máxima, opcional
    const releaseYear = req.query.releaseYear || ''; // ano de lançamento, opcional
    const genre = req.query.genre || ''; // gênero, opcional
    const sortBy = req.query.sortBy || 'Nome'; // ordenar por, padrão é nome
    const orderBy = req.query.orderBy || 'ASC'; // ordem, padrão é ascendente

    let sql = `
        SELECT Filme.*, Genero.Nome AS Genero 
        FROM Filme 
        JOIN Genero ON Filme.FK_Genero = Genero.Id 
        WHERE Filme.Nome LIKE ? 
        AND Filme.Duracao >= ? 
        AND Filme.Duracao <= ? 
        AND YEAR(Filme.DataLancamento) LIKE ? 
        AND Genero.id LIKE ? 
        ORDER BY ${sortBy} ${orderBy}
    `;

    // Valores para substituir na consulta SQL
    const values = [
        `%${searchTerm}%`,
        minDuration,
        maxDuration,
        `%${releaseYear}%`,
        `%${genre}%`
    ];

    console.log(sql)

    mySql.query(sql, values, (err, results) => {
        if (err) {
            console.error('Erro ao buscar filmes:', err);
            res.status(500).json({ error: 'Erro ao buscar filmes' });
            return;
        }
        res.json(results); // Envia os resultados como resposta em formato JSON
    });
});

app.listen(3000, () => {
    console.log('SERVIDOR ATIVO, ACESSE http://localhost:3000');
});