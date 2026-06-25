package com.bidly.bidly_backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "subasta_revision")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SubastaRevision {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long identificador;

    @ManyToOne(optional = false)
    @JoinColumn(name = "subasta", unique = true, nullable = false)
    private Subasta subasta;

    @Column(nullable = false)
    private Long solicitante;

    @Column(nullable = false)
    private String estado;

    @Column(name = "fechasolicitud", nullable = false)
    private LocalDateTime fechaSolicitud;

    @Column(name = "fecharevision")
    private LocalDateTime fechaRevision;

    private String observacion;
}
