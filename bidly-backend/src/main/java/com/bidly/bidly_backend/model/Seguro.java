package com.bidly.bidly_backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "seguros")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Seguro {

    @Id
    @Column(name = "nropoliza")
    private String nroPoliza;

    private String compania;

    @Column(name = "polizacombinada")
    private String polizaCombinada;

    private BigDecimal importe;
}
