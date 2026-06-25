package com.bidly.bidly_backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "mediosdepago")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MedioPago {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long identificador;

    @ManyToOne
    @JoinColumn(name = "cliente")
    private Cliente cliente;

    private String tipo;
    @Column(name = "numerotarjeta")
    private String numeroTarjeta;
    private String vencimiento;
    private String titular;

    @Column(name = "numerocuenta")
    private String numeroCuenta;
    private String banco;

    @Column(name = "numerocheque")
    private String numeroCheque;

    @Column(name = "montocheque")
    private BigDecimal montoCheque;
    private String verificado;
}
