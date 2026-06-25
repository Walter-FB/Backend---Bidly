from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base


class Reembolso(Base):
    __tablename__ = "reembolsos"

    registro    = Column(Integer, ForeignKey("registrodesubasta.identificador"), primary_key=True)
    reembolsada = Column(String, default="no")
