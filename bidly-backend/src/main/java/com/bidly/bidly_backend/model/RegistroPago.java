package com.bidly.bidly_backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "registro_pago")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RegistroPago {

    @Id
    @Column(name = "registro")
    private Long registro;

    private String estado = "pendiente";

    @Column(name = "medio_pago")
    private Long medioPago;

    @Column(name = "importe_total")
    private BigDecimal importeTotal;

    @Column(name = "fecha_pago")
    private LocalDateTime fechaPago;
}
