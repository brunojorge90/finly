import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime

DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    import psycopg2
    import psycopg2.extras
    P = "%s"
else:
    DB_PATH = os.environ.get("DB_PATH", "./finance.db")
    os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)
    P = "?"


@contextmanager
def _cur():
    """Cursor context manager — funciona com SQLite e PostgreSQL."""
    if DATABASE_URL:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            cur = conn.cursor()
            yield cur
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        try:
            cur = conn.cursor()
            yield cur
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def _rows(rows) -> list[dict]:
    return [dict(r) for r in rows]


def _row(row) -> dict | None:
    return dict(row) if row else None


# ---------- init ----------

def init_db():
    with _cur() as cur:
        if DATABASE_URL:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id    SERIAL PRIMARY KEY,
                    nome  TEXT   NOT NULL,
                    email TEXT   NOT NULL UNIQUE,
                    senha TEXT   NOT NULL
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS transacoes (
                    id             SERIAL  PRIMARY KEY,
                    user_id        INTEGER NOT NULL,
                    tipo           TEXT    NOT NULL CHECK (tipo IN ('entrada', 'saida')),
                    valor          NUMERIC NOT NULL,
                    descricao      TEXT    NOT NULL,
                    categoria      TEXT    NOT NULL,
                    data           TEXT    NOT NULL,
                    pagamento      TEXT    DEFAULT NULL,
                    parcela_grupo  TEXT    DEFAULT NULL,
                    parcela_num    INTEGER DEFAULT NULL,
                    parcela_total  INTEGER DEFAULT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """)
            # Migrações: adiciona colunas se não existirem
            for col, definition in [
                ("pagamento",     "TEXT DEFAULT NULL"),
                ("parcela_grupo", "TEXT DEFAULT NULL"),
                ("parcela_num",   "INTEGER DEFAULT NULL"),
                ("parcela_total", "INTEGER DEFAULT NULL"),
            ]:
                cur.execute(f"""
                    ALTER TABLE transacoes
                    ADD COLUMN IF NOT EXISTS {col} {definition}
                """)
        else:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id    INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome  TEXT    NOT NULL,
                    email TEXT    NOT NULL UNIQUE,
                    senha TEXT    NOT NULL
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS transacoes (
                    id             INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id        INTEGER NOT NULL,
                    tipo           TEXT    NOT NULL CHECK (tipo IN ('entrada', 'saida')),
                    valor          REAL    NOT NULL,
                    descricao      TEXT    NOT NULL,
                    categoria      TEXT    NOT NULL,
                    data           TEXT    NOT NULL,
                    pagamento      TEXT    DEFAULT NULL,
                    parcela_grupo  TEXT    DEFAULT NULL,
                    parcela_num    INTEGER DEFAULT NULL,
                    parcela_total  INTEGER DEFAULT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """)
            try:
                cur.execute("ALTER TABLE transacoes ADD COLUMN pagamento TEXT DEFAULT NULL")
            except sqlite3.OperationalError:
                pass
            try:
                cur.execute("ALTER TABLE transacoes ADD COLUMN parcela_grupo TEXT DEFAULT NULL")
            except sqlite3.OperationalError:
                pass
            try:
                cur.execute("ALTER TABLE transacoes ADD COLUMN parcela_num INTEGER DEFAULT NULL")
            except sqlite3.OperationalError:
                pass
            try:
                cur.execute("ALTER TABLE transacoes ADD COLUMN parcela_total INTEGER DEFAULT NULL")
            except sqlite3.OperationalError:
                pass


# ---------- users ----------

def criar_usuario(nome: str, email: str, senha_hash: str) -> int:
    with _cur() as cur:
        if DATABASE_URL:
            cur.execute(
                f"INSERT INTO users (nome, email, senha) VALUES ({P},{P},{P}) RETURNING id",
                (nome, email, senha_hash),
            )
            return cur.fetchone()["id"]
        else:
            cur.execute(
                f"INSERT INTO users (nome, email, senha) VALUES ({P},{P},{P})",
                (nome, email, senha_hash),
            )
            return cur.lastrowid


def buscar_usuario_por_email(email: str) -> dict | None:
    with _cur() as cur:
        cur.execute(f"SELECT * FROM users WHERE email = {P}", (email,))
        return _row(cur.fetchone())


def buscar_usuario_por_id(user_id: int) -> dict | None:
    with _cur() as cur:
        cur.execute(f"SELECT * FROM users WHERE id = {P}", (user_id,))
        return _row(cur.fetchone())


# ---------- transacoes ----------

def salvar_transacao(
    user_id: int, tipo: str, valor: float,
    descricao: str, categoria: str, data: str | None = None,
    parcela_grupo: str | None = None,
    parcela_num: int | None = None,
    parcela_total: int | None = None,
) -> int:
    if data is None:
        data = datetime.now().strftime("%Y-%m-%d")
    with _cur() as cur:
        sql = (
            f"INSERT INTO transacoes "
            f"(user_id, tipo, valor, descricao, categoria, data, parcela_grupo, parcela_num, parcela_total) "
            f"VALUES ({P},{P},{P},{P},{P},{P},{P},{P},{P})"
        )
        args = (user_id, tipo, valor, descricao, categoria, data, parcela_grupo, parcela_num, parcela_total)
        if DATABASE_URL:
            cur.execute(sql + " RETURNING id", args)
            return cur.fetchone()["id"]
        else:
            cur.execute(sql, args)
            return cur.lastrowid


def deletar_grupo_parcelas(transacao_id: int, user_id: int) -> int:
    """Deleta todas as parcelas do mesmo grupo. Retorna o número de linhas deletadas."""
    with _cur() as cur:
        cur.execute(
            f"SELECT parcela_grupo FROM transacoes WHERE id = {P} AND user_id = {P}",
            (transacao_id, user_id),
        )
        row = _row(cur.fetchone())
        if not row or not row["parcela_grupo"]:
            return 0
        grupo = row["parcela_grupo"]
        cur.execute(
            f"DELETE FROM transacoes WHERE parcela_grupo = {P} AND user_id = {P}",
            (grupo, user_id),
        )
        return cur.rowcount


def deletar_transacao(transacao_id: int, user_id: int) -> bool:
    with _cur() as cur:
        cur.execute(
            f"DELETE FROM transacoes WHERE id = {P} AND user_id = {P}",
            (transacao_id, user_id),
        )
        return cur.rowcount > 0


def atualizar_pagamento(transacao_id: int, user_id: int, pagamento: str) -> bool:
    with _cur() as cur:
        cur.execute(
            f"UPDATE transacoes SET pagamento = {P} WHERE id = {P} AND user_id = {P}",
            (pagamento, transacao_id, user_id),
        )
        return cur.rowcount > 0


def buscar_transacoes(user_id: int, limite: int = 50) -> list[dict]:
    with _cur() as cur:
        cur.execute(
            f"SELECT * FROM transacoes WHERE user_id = {P} ORDER BY data DESC, id DESC LIMIT {P}",
            (user_id, limite),
        )
        return _rows(cur.fetchall())


def resumo_por_categoria(user_id: int) -> list[dict]:
    with _cur() as cur:
        cur.execute(f"""
            SELECT categoria, tipo, SUM(valor) AS total
            FROM transacoes
            WHERE user_id = {P}
            GROUP BY categoria, tipo
            ORDER BY categoria, tipo
        """, (user_id,))
        return _rows(cur.fetchall())


def resumo_mensal(user_id: int) -> list[dict]:
    with _cur() as cur:
        cur.execute(f"""
            SELECT
                substr(data, 1, 7) AS mes,
                COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) AS entradas,
                COALESCE(SUM(CASE WHEN tipo = 'saida'   THEN valor ELSE 0 END), 0) AS saidas
            FROM transacoes
            WHERE user_id = {P}
            GROUP BY mes
            ORDER BY mes DESC
        """, (user_id,))
        return _rows(cur.fetchall())


def investimentos(user_id: int) -> list[dict]:
    with _cur() as cur:
        cur.execute(f"""
            SELECT * FROM transacoes
            WHERE user_id = {P} AND categoria = 'Investimentos'
            ORDER BY data DESC, id DESC
        """, (user_id,))
        return _rows(cur.fetchall())


def saldo_atual(user_id: int) -> float:
    with _cur() as cur:
        cur.execute(f"""
            SELECT
                COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) -
                COALESCE(SUM(CASE WHEN tipo = 'saida'   THEN valor ELSE 0 END), 0) AS saldo
            FROM transacoes
            WHERE user_id = {P}
        """, (user_id,))
        row = cur.fetchone()
        return float(row["saldo"])


def totais_vouchers(user_id: int) -> dict:
    with _cur() as cur:
        cur.execute(f"""
            SELECT pagamento, SUM(valor) AS total
            FROM transacoes
            WHERE user_id = {P} AND pagamento IN ('VR', 'VA')
            GROUP BY pagamento
        """, (user_id,))
        result = {"VR": 0.0, "VA": 0.0}
        for row in cur.fetchall():
            result[row["pagamento"]] = float(row["total"])
        return result
