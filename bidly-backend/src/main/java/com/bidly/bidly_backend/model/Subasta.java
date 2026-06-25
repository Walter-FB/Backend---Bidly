package com.bidly.bidly_backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
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
    @Transient
    private String moneda;
    @Transient
    private BigDecimal precioBase;
    @Transient
    private Long totalAsistentes;
    @Transient
    private String titulo;
    @Transient
    private Integer totalItems;
    @Transient
    private String revisionEstado;
  /** pendiente | programada | en_curso | finalizada */
    @Transient
    private String fase;
    @Transient
    private Long segundosRestantes;
    @Transient
    private Integer itemsPendientes;
    @Transient
    private Boolean algunaVezAbierta;
    @Transient
    private LocalDateTime fechaApertura;
    @Transient
    private String estadoSubasta;
    @Transient
    private LocalDateTime fechaInicioReal;
}
