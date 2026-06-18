package com.bidly.bidly_backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "subasta_moneda")
public class SubastaMoneda {
    @Id
    @Column(name = "subasta")
    private Long subasta;
    @Column(name = "moneda")
    private String moneda;

    public Long getSubasta() { return subasta; }
    public void setSubasta(Long subasta) { this.subasta = subasta; }
    public String getMoneda() { return moneda; }
    public void setMoneda(String moneda) { this.moneda = moneda; }
}
