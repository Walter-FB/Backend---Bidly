package com.bidly.bidly_backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "pujos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Puja {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long identificador;

    @ManyToOne
    @JoinColumn(name = "asistente")
    private Asistente asistente;

    @ManyToOne
    @JoinColumn(name = "item")
    private ItemCatalogo item;

    private BigDecimal importe;
    private String ganador;
    @Column(name = "fechahora")
    private LocalDateTime fechaHora;
}
