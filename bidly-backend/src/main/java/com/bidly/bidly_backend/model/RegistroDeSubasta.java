package com.bidly.bidly_backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "registrodesubasta")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RegistroDeSubasta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long identificador;

    @ManyToOne
    @JoinColumn(name = "subasta")
    private Subasta subasta;

    private Long duenio;
    private Long producto;

    @ManyToOne
    @JoinColumn(name = "cliente")
    private Cliente cliente;

    private BigDecimal importe;
    private BigDecimal comision;
    private String reembolsada;
}
