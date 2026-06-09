package com.bidly.bidly_backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity
@Table(name = "productos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Producto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long identificador;

    private LocalDate fecha;
    private String disponible;
    @Column(name = "descripcioncatalogo")
    private String descripcionCatalogo;

    @Column(name = "descripcioncompleta")
    private String descripcionCompleta;
    private Long revisor;
    private Long duenio;
    private String seguro;
}
