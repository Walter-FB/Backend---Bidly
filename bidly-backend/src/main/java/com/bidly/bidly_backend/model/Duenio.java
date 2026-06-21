package com.bidly.bidly_backend.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "duenios")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Duenio {

    @Id
    private Long identificador;

    @Column(name = "numeropais")
    private Integer numeroPais;

    @Column(name = "verificacionfinanciera")
    private String verificacionFinanciera;

    @Column(name = "verificacionjudicial")
    private String verificacionJudicial;

    @Column(name = "calificacionriesgo")
    private Integer calificacionRiesgo;

    @Column(name = "verificador", nullable = false)
    private Long verificador;
}
