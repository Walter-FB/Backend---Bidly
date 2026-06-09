package com.bidly.bidly_backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "subastas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Subasta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long identificador;

    private LocalDate fecha;
    private LocalTime hora;
    private String estado;
    private Long subastador;
    private String ubicacion;
    private String categoria;
    private String moneda;
}
