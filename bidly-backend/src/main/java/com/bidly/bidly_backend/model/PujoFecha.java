package com.bidly.bidly_backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "pujo_fecha")
public class PujoFecha {
    @Id
    @Column(name = "pujo")
    private Long pujo;
    @Column(name = "fechahora")
    private LocalDateTime fechaHora;

    public Long getPujo() { return pujo; }
    public void setPujo(Long pujo) { this.pujo = pujo; }
    public LocalDateTime getFechaHora() { return fechaHora; }
    public void setFechaHora(LocalDateTime fechaHora) { this.fechaHora = fechaHora; }
}
