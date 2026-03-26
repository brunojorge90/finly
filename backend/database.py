import sqlite3
from datetime import datetime

DB_PATH = "finance.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS transacoes (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo      TEXT    NOT NULL CHECK (tipo IN ('entrada', 'saida')),
                valor     REAL    NOT NULL,
                descricao TEXT    NOT NULL,
                categoria TEXT    NOT NULL,
                data      TEXT    NOT NULL
            )
        """)


def salvar_transacao(tipo: str, valor: float, descricao: str, categoria: str, data: str | None = None):
    if data is None:
        data = datetime.now().strftime("%Y-%m-%d")
    with get_conn() as conn:
        cursor = conn.execute(
            "INSERT INTO transacoes (tipo, valor, descricao, categoria, data) VALUES (?, ?, ?, ?, ?)",
            (tipo, valor, descricao, categoria, data),
        )
        return cursor.lastrowid


def buscar_transacoes(limite: int = 50) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM transacoes ORDER BY data DESC, id DESC LIMIT ?",
            (limite,),
        ).fetchall()
        return [dict(row) for row in rows]


def resumo_por_categoria() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT categoria, tipo, SUM(valor) AS total
            FROM transacoes
            GROUP BY categoria, tipo
            ORDER BY categoria, tipo
        """).fetchall()
        return [dict(row) for row in rows]


def saldo_atual() -> float:
    with get_conn() as conn:
        row = conn.execute("""
            SELECT
                COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) -
                COALESCE(SUM(CASE WHEN tipo = 'saida'   THEN valor ELSE 0 END), 0) AS saldo
            FROM transacoes
        """).fetchone()
        return row["saldo"]
