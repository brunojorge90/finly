import os
import uuid
from dotenv import load_dotenv
from dateutil.relativedelta import relativedelta
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
    deletar_grupo_parcelas,
    deletar_transacao,
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

    # Compra parcelada — cria N transações com datas incrementais
    if transacao.parcelas > 1:
        data_base = transacao.data
        grupo_id = str(uuid.uuid4())
        valor_parcela = round(transacao.valor / transacao.parcelas, 2)
        resultado = []

        for i in range(transacao.parcelas):
            data_parcela = data_base + relativedelta(months=i)
            data_str = data_parcela.strftime("%Y-%m-%d")
            descricao_parcela = f"{transacao.descricao} {i + 1}/{transacao.parcelas}"

            id_criado = salvar_transacao(
                user_id=user_id,
                tipo=transacao.tipo,
                valor=valor_parcela,
                descricao=descricao_parcela,
                categoria=transacao.categoria.value,
                data=data_str,
                parcela_grupo=grupo_id,
                parcela_num=i + 1,
                parcela_total=transacao.parcelas,
            )

            resultado.append({
                "id": id_criado,
                "tipo": transacao.tipo,
                "valor": valor_parcela,
                "descricao": descricao_parcela,
                "categoria": transacao.categoria.value,
                "data": data_str,
                "parcela_grupo": grupo_id,
                "parcela_num": i + 1,
                "parcela_total": transacao.parcelas,
            })

        return resultado

    # Transação normal — fluxo original
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


@app.delete("/transacao/{transacao_id}", status_code=200)
def remover_transacao(transacao_id: int, user_id: int = Depends(get_current_user)):
    if not deletar_transacao(transacao_id, user_id):
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    return {"ok": True}


@app.delete("/transacao/{transacao_id}/grupo", status_code=200)
def remover_grupo_parcelas(transacao_id: int, user_id: int = Depends(get_current_user)):
    count = deletar_grupo_parcelas(transacao_id, user_id)
    if count == 0:
        raise HTTPException(status_code=404, detail="Grupo de parcelas não encontrado")
    return {"ok": True, "deletadas": count}


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
