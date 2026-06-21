package com.bidly.bidly_backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.util.List;

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

    @JsonIgnore
    @OneToMany(mappedBy = "producto", fetch = FetchType.LAZY)
    private List<Foto> fotos;
}