import os
from dotenv import load_dotenv
load_dotenv()  # carrega .env antes de qualquer import que use variáveis de ambiente

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from categorizer import categorizar
from database import (
    buscar_transacoes,
    init_db,
    resumo_por_categoria,
    saldo_atual,
    salvar_transacao,
)

app = FastAPI(title="Agente Financeiro API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


# ---------- schemas ----------

class TextoLivre(BaseModel):
    texto: str


# ---------- rotas ----------

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/transacao", status_code=201)
def criar_transacao(body: TextoLivre):
    try:
        transacao = categorizar(body.texto)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    id_criado = salvar_transacao(
        tipo=transacao.tipo,
        valor=transacao.valor,
        descricao=transacao.descricao,
        categoria=transacao.categoria.value,
        data=transacao.data.strftime("%Y-%m-%d"),
    )

    return {
        "id": id_criado,
        "tipo": transacao.tipo,
        "valor": transacao.valor,
        "descricao": transacao.descricao,
        "categoria": transacao.categoria.value,
        "data": transacao.data.strftime("%Y-%m-%d"),
    }


@app.get("/transacoes")
def listar_transacoes():
    return buscar_transacoes(limite=50)


@app.get("/resumo")
def obter_resumo():
    return resumo_por_categoria()


@app.get("/saldo")
def obter_saldo():
    return {"saldo": saldo_atual()}
