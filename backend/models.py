from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class Categoria(str, Enum):
    Alimentacao  = "Alimentacao"
    Transporte   = "Transporte"
    Moradia      = "Moradia"
    Saude        = "Saude"
    Lazer        = "Lazer"
    Educacao     = "Educacao"
    Salario      = "Salario"
    Freelance    = "Freelance"
    Investimentos = "Investimentos"
    Outros       = "Outros"


@dataclass
class Transacao:
    tipo:      str
    valor:     float
    descricao: str
    categoria: Categoria
    data:      datetime = field(default_factory=datetime.now)
    id:        int | None = None
