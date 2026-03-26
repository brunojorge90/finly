import os
import sqlite3
from datetime import datetime

DB_PATH = os.environ.get("DB_PATH", "/tmp/finance.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id    INTEGER PRIMARY KEY AUTOINCREMENT,
                nome  TEXT    NOT NULL,
                email TEXT    NOT NULL UNIQUE,
                senha TEXT    NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS transacoes (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id   INTEGER NOT NULL,
                tipo      TEXT    NOT NULL CHECK (tipo IN ('entrada', 'saida')),
                valor     REAL    NOT NULL,
                descricao TEXT    NOT NULL,
                categoria TEXT    NOT NULL,
                data      TEXT    NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)


# ---------- users ----------

def criar_usuario(nome: str, email: str, senha_hash: str) -> int:
    with get_conn() as conn:
        cursor = conn.execute(
            "INSERT INTO users (nome, email, senha) VALUES (?, ?, ?)",
            (nome, email, senha_hash),
        )
        return cursor.lastrowid


def buscar_usuario_por_email(email: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        return dict(row) if row else None


def buscar_usuario_por_id(user_id: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None


# ---------- transacoes ----------

def salvar_transacao(user_id: int, tipo: str, valor: float, descricao: str, categoria: str, data: str | None = None):
    if data is None:
        data = datetime.now().strftime("%Y-%m-%d")
    with get_conn() as conn:
        cursor = conn.execute(
            "INSERT INTO transacoes (user_id, tipo, valor, descricao, categoria, data) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, tipo, valor, descricao, categoria, data),
        )
        return cursor.lastrowid


def buscar_transacoes(user_id: int, limite: int = 50) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM transacoes WHERE user_id = ? ORDER BY data DESC, id DESC LIMIT ?",
            (user_id, limite),
        ).fetchall()
        return [dict(row) for row in rows]


def resumo_por_categoria(user_id: int) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT categoria, tipo, SUM(valor) AS total
            FROM transacoes
            WHERE user_id = ?
            GROUP BY categoria, tipo
            ORDER BY categoria, tipo
        """, (user_id,)).fetchall()
        return [dict(row) for row in rows]


def saldo_atual(user_id: int) -> float:
    with get_conn() as conn:
        row = conn.execute("""
            SELECT
                COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) -
                COALESCE(SUM(CASE WHEN tipo = 'saida'   THEN valor ELSE 0 END), 0) AS saldo
            FROM transacoes
            WHERE user_id = ?
        """, (user_id,)).fetchone()
        return row["saldo"]
