package com.bidly.bidly_backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "reembolsos")
public class Reembolso {
    @Id
    @Column(name = "registro")
    private Long registro;
    @Column(name = "reembolsada")
    private String reembolsada;

    public Long getRegistro() { return registro; }
    public void setRegistro(Long registro) { this.registro = registro; }
    public String getReembolsada() { return reembolsada; }
    public void setReembolsada(String reembolsada) { this.reembolsada = reembolsada; }
}
