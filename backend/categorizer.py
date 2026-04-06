from datetime import datetime, timedelta, timezone
import os
import unicodedata

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
    intencao: str = Field(
        default="nova",
        description="'nova' para nova transação normal. 'atualizacao' quando o usuário diz 'atualizar', 'tenho X investido', 'meu investimento agora é X', 'atualize meu investimento'."
    )
    tipo: str = Field(description="'entrada' para receitas, 'saida' para despesas. Ignorado quando intencao='atualizacao'.")
    valor: float = Field(description="Valor numérico positivo. Quando intencao='atualizacao', é o NOVO TOTAL do investimento.")
    descricao: str = Field(description="Descrição resumida da transação")
    categoria: str = Field(
        description=(
            "Uma das categorias: Alimentacao, Transporte, Moradia, Saude, Lazer, "
            "Educacao, Salario, Freelance, Investimentos, Outros. "
            "Quando intencao='atualizacao', sempre use Investimentos."
        )
    )
    data: str = Field(
        description="Data da transação no formato YYYY-MM-DD."
    )
    parcelas: int = Field(
        default=1,
        description="Número de parcelas como número inteiro. Detecte padrões como '6x', 'x6', 'em 6x'. Sem parcelamento = 1."
    )

    @field_validator("parcelas", mode="before")
    @classmethod
    def coerce_parcelas(cls, v):
        try:
            return int(v)
        except (ValueError, TypeError):
            return 1


_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "Você é um assistente financeiro. Analise o texto do usuário e extraia "
                "os dados da transação financeira. Responda APENAS com um objeto JSON válido.\n\n"
                "Data de hoje: {hoje}\n\n"
                "Regras:\n"
                "- intencao: 'atualizacao' quando o usuário usar palavras como 'atualizar', 'atualize', 'tenho X investido', 'meu investimento é X'. Caso contrário, 'nova'.\n"
                "- tipo: USE 'saida' por padrão para qualquer gasto/despesa/compra/pagamento/conta/mensalidade. Use 'entrada' APENAS quando houver palavra explícita de receita: recebi, salário, freelance, renda, depósito, pagamento recebido\n"
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
    return _prompt | _get_llm().with_structured_output(TransacaoSchema, method="json_mode")



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

    # Normaliza categoria: remove acentos e espaços para garantir match com o enum
    categoria_raw = unicodedata.normalize("NFD", resultado.categoria)
    categoria_str = "".join(c for c in categoria_raw if unicodedata.category(c) != "Mn")

    try:
        categoria = Categoria(categoria_str)
    except ValueError:
        categoria = Categoria.Outros

    return Transacao(
        tipo=resultado.tipo,
        valor=resultado.valor,
        descricao=resultado.descricao,
        categoria=categoria,
        data=data_transacao,
        parcelas=resultado.parcelas,
        intencao=resultado.intencao,
    )
