from datetime import datetime
import os

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

from models import Categoria, Transacao

load_dotenv()

llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")


class TransacaoSchema(BaseModel):
    tipo: str = Field(description="'entrada' para receitas, 'saida' para despesas")
    valor: float = Field(description="Valor numérico positivo da transação")
    descricao: str = Field(description="Descrição resumida da transação")
    categoria: str = Field(
        description=(
            "Uma das categorias: Alimentacao, Transporte, Moradia, Saude, Lazer, "
            "Educacao, Salario, Freelance, Investimentos, Outros"
        )
    )


_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "Você é um assistente financeiro. Analise o texto do usuário e extraia "
                "os dados da transação financeira.\n\n"
                "Regras:\n"
                "- tipo: 'entrada' para receitas/ganhos, 'saida' para despesas/gastos\n"
                "- valor: número positivo (converta 'reais'/'R$' para float)\n"
                "- descricao: texto curto e claro descrevendo a transação\n"
                "- categoria: escolha a mais adequada entre as disponíveis\n\n"
                "Exemplos:\n"
                "  'gasto coca 3 reais' → saida, 3.0, 'Coca-Cola', Alimentacao\n"
                "  'recebi salário 5000' → entrada, 5000.0, 'Salário', Salario\n"
                "  'uber 15 reais' → saida, 15.0, 'Uber', Transporte"
            ),
        ),
        ("human", "{texto}"),
    ]
)

_chain = _prompt | llm.with_structured_output(TransacaoSchema)


def categorizar(texto: str) -> Transacao:
    resultado: TransacaoSchema = _chain.invoke({"texto": texto})
    return Transacao(
        tipo=resultado.tipo,
        valor=resultado.valor,
        descricao=resultado.descricao,
        categoria=Categoria(resultado.categoria),
        data=datetime.now(),
    )
