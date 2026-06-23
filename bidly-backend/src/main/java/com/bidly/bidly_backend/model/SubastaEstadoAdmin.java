package com.bidly.bidly_backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "subasta_estado_admin")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SubastaEstadoAdmin {

    @Id
    @Column(name = "subasta")
    private Long subasta;

    private String estado;

    @Column(name = "alguna_vez_abierta")
    private Boolean algunaVezAbierta = false;

    @Column(name = "fecha_apertura")
    private LocalDateTime fechaApertura;
}
