import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from auth import create_token, decode_token, hash_password, verify_password
from categorizer import categorizar
from database import (
    atualizar_pagamento,
    buscar_transacoes,
    buscar_usuario_por_email,
    buscar_usuario_por_id,
    criar_usuario,
    init_db,
    investimentos,
    resumo_mensal,
    resumo_por_categoria,
    saldo_atual,
    salvar_transacao,
    totais_vouchers,
)

app = FastAPI(title="Finly API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()


@app.on_event("startup")
def startup():
    init_db()


# ---------- auth ----------

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> int:
    try:
        return decode_token(credentials.credentials)
    except ValueError:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")


# ---------- schemas ----------

class TextoLivre(BaseModel):
    texto: str


class RegisterBody(BaseModel):
    nome: str
    email: str
    senha: str


class LoginBody(BaseModel):
    email: str
    senha: str


class PagamentoBody(BaseModel):
    pagamento: str  # "VR" | "VA" | "Cartao"


# ---------- rotas públicas ----------

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/register", status_code=201)
def register(body: RegisterBody):
    if buscar_usuario_por_email(body.email):
        raise HTTPException(status_code=409, detail="E-mail já cadastrado")
    user_id = criar_usuario(body.nome, body.email, hash_password(body.senha))
    token = create_token(user_id)
    return {"token": token, "nome": body.nome, "email": body.email}


@app.post("/login")
def login(body: LoginBody):
    user = buscar_usuario_por_email(body.email)
    if not user or not verify_password(body.senha, user["senha"]):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")
    token = create_token(user["id"])
    return {"token": token, "nome": user["nome"], "email": user["email"]}


# ---------- rotas protegidas ----------

@app.post("/transacao", status_code=201)
def criar_transacao(body: TextoLivre, user_id: int = Depends(get_current_user)):
    try:
        transacao = categorizar(body.texto)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    id_criado = salvar_transacao(
        user_id=user_id,
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
def listar_transacoes(user_id: int = Depends(get_current_user)):
    return buscar_transacoes(user_id=user_id, limite=50)


@app.get("/resumo")
def obter_resumo(user_id: int = Depends(get_current_user)):
    return resumo_por_categoria(user_id=user_id)


@app.get("/saldo")
def obter_saldo(user_id: int = Depends(get_current_user)):
    return {"saldo": saldo_atual(user_id=user_id)}


@app.get("/mensal")
def obter_mensal(user_id: int = Depends(get_current_user)):
    return resumo_mensal(user_id=user_id)


@app.get("/investimentos")
def obter_investimentos(user_id: int = Depends(get_current_user)):
    return investimentos(user_id=user_id)


@app.patch("/transacao/{transacao_id}/pagamento")
def set_pagamento(transacao_id: int, body: PagamentoBody, user_id: int = Depends(get_current_user)):
    if body.pagamento not in ("VR", "VA", "Cartao"):
        raise HTTPException(status_code=422, detail="Valor de pagamento inválido")
    if not atualizar_pagamento(transacao_id, user_id, body.pagamento):
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    return {"ok": True}


@app.get("/vouchers")
def obter_vouchers(user_id: int = Depends(get_current_user)):
    return totais_vouchers(user_id=user_id)
