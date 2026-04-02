from datetime import datetime, timedelta, timezone
import os

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

from models import Categoria, Transacao

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", google_api_key=api_key)

# Fuso horário de Brasília (UTC-3)
TZ_BRASILIA = timezone(timedelta(hours=-3))


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

_chain = _prompt | llm.with_structured_output(TransacaoSchema)


from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

def responder_chat(mensagens: list, system_prompt: str) -> str:
    try:
        history = [SystemMessage(content=system_prompt)]
        for m in mensagens:
            if m["role"] == "user":
                history.append(HumanMessage(content=m["content"]))
            else:
                history.append(AIMessage(content=m["content"]))
        
        resposta = llm.invoke(history)
        if not resposta or not resposta.content:
            raise ValueError("A API do Gemini retornou uma resposta vazia. Verifique sua cota e chave de API.")
            
        return resposta.content
    except Exception as e:
        print(f"ERRO NO CHAT: {str(e)}")
        raise e


def categorizar(texto: str) -> Transacao:
    # Obtém a hora atual em Brasília
    agora_br = datetime.now(TZ_BRASILIA)
    hoje = agora_br.strftime("%Y-%m-%d")
    
    resultado: TransacaoSchema = _chain.invoke({"texto": texto, "hoje": hoje})
    
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
