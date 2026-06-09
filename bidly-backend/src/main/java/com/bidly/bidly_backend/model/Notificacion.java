package com.bidly.bidly_backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "notificaciones")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Notificacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long identificador;

    @ManyToOne
    @JoinColumn(name = "cliente")
    private Cliente cliente;

    private String tipo;
    private String mensaje;
    private String leida;

    @Column(name = "fechahora")
    private LocalDateTime fechaHora;
}
