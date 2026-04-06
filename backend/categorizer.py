from datetime import datetime, timedelta, timezone
import os

from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field, field_validator

from models import Categoria, Transacao

load_dotenv()

# Fuso horário de Brasília (UTC-3)
TZ_BRASILIA = timezone(timedelta(hours=-3))

_llm = None

def _get_llm():
    global _llm
    if _llm is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY não configurada")
        _llm = ChatGroq(model="llama-3.1-8b-instant", groq_api_key=api_key)
    return _llm


class TransacaoSchema(BaseModel):
    tipo: str = Field(description="'entrada' para receitas, 'saida' para despesas")
    valor: float = Field(description="Valor numérico TOTAL positivo da transação. Se for parcelado, retorne o valor total, não o valor da parcela.")
    descricao: str = Field(description="Descrição resumida da transação")
    categoria: str = Field(
        description=(
            "Uma das categorias: Alimentacao, Transporte, Moradia, Saude, Lazer, "
            "Educacao, Salario, Freelance, Investimentos, Outros"
        )
    )
    data: str = Field(
        description="Data da transação no formato YYYY-MM-DD. Se o usuário disser 'ontem', 'anteontem' ou uma data específica, calcule-a com base na data de hoje. Se não houver menção à data, use a data de hoje."
    )
    parcelas: int = Field(
        default=1,
        description="Número de parcelas. Detecte padrões como '6x', 'x6', 'em 6x', 'parcelado em 6 vezes'. Se não houver parcelamento, retorne 1."
    )

    @field_validator("parcelas", "valor", mode="before")
    @classmethod
    def coerce_number(cls, v):
        try:
            return int(v) if isinstance(v, str) and "." not in str(v) else float(v) if isinstance(v, str) else v
        except (ValueError, TypeError):
            return v


_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "Você é um assistente financeiro. Analise o texto do usuário e extraia "
                "os dados da transação financeira.\n\n"
                "Data de hoje: {hoje}\n\n"
                "Regras:\n"
                "- tipo: 'entrada' para receitas/ganhos, 'saida' para despesas/gastos\n"
                "- valor: número positivo TOTAL (converta 'reais'/'R$' para float). Se parcelado, retorne o valor total.\n"
                "- descricao: texto curto e claro descrevendo a transação\n"
                "- categoria: escolha a mais adequada entre as disponíveis\n"
                "- data: calcule a data correta baseada no texto do usuário e na data de hoje.\n"
                "- parcelas: número de parcelas. Detecte '6x', 'x6', 'em 6x', '6 vezes', 'parcelado em 6'. Sem parcelamento = 1.\n\n"
                "Exemplos:\n"
                "  'gasto coca 3 reais' → saida, 3.0, 'Coca-Cola', Alimentacao, {hoje}, parcelas=1\n"
                "  'recebi salário 5000' → entrada, 5000.0, 'Salário', Salario, {hoje}, parcelas=1\n"
                "  'uber 15 reais ontem' → saida, 15.0, 'Uber', Transporte, (data de ontem), parcelas=1\n"
                "  'roupa 400 6x' → saida, 400.0, 'Roupa', Outros, {hoje}, parcelas=6\n"
                "  'iPhone 2500 em 12x' → saida, 2500.0, 'iPhone', Outros, {hoje}, parcelas=12\n"
                "  'geladeira 1800 parcelado em 10 vezes' → saida, 1800.0, 'Geladeira', Moradia, {hoje}, parcelas=10"
            ),
        ),
        ("human", "{texto}"),
    ]
)

def _get_chain():
    return _prompt | _get_llm().with_structured_output(TransacaoSchema)



def categorizar(texto: str) -> Transacao:
    # Obtém a hora atual em Brasília
    agora_br = datetime.now(TZ_BRASILIA)
    hoje = agora_br.strftime("%Y-%m-%d")
    
    resultado: TransacaoSchema = _get_chain().invoke({"texto": texto, "hoje": hoje})
    
    try:
        # Tenta converter a data retornada pela IA de volta para datetime
        data_transacao = datetime.strptime(resultado.data, "%Y-%m-%d")
    except (ValueError, TypeError):
        # Se a IA falhar em retornar uma data válida, usa o momento atual de Brasília
        data_transacao = agora_br

    return Transacao(
        tipo=resultado.tipo,
        valor=resultado.valor,
        descricao=resultado.descricao,
        categoria=Categoria(resultado.categoria),
        data=data_transacao,
        parcelas=resultado.parcelas,
    )
