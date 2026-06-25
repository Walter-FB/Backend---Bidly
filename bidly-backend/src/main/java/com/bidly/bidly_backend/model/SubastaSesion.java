package com.bidly.bidly_backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "subasta_sesion")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SubastaSesion {

    @Id
    @Column(name = "subasta")
    private Long subasta;

    @Column(name = "item_activo", nullable = false)
    private Long itemActivo;

    @Column(name = "orden_actual", nullable = false)
    private Integer ordenActual = 1;

    @Column(name = "timer_desde", nullable = false)
    private LocalDateTime timerDesde;

    @Column(name = "iniciada_en", nullable = false)
    private LocalDateTime iniciadaEn;
}
