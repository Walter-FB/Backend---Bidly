package com.bidly.bidly_backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "dni_verificacion")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DniVerificacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "cliente_id", nullable = false)
    private Long clienteId;

    @Column(name = "foto_frente", columnDefinition = "TEXT")
    private String fotoFrente;

    @Column(name = "foto_dorso", columnDefinition = "TEXT")
    private String fotoDorso;

    @Column(name = "creado_en")
    private LocalDateTime creadoEn;
}
