package com.bidly.bidly_backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "itemscatalogo")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ItemCatalogo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long identificador;

    @ManyToOne
    @JoinColumn(name = "catalogo")
    private Catalogo catalogo;

    @ManyToOne
    @JoinColumn(name = "producto")
    private Producto producto;
    @Column(name = "preciobase")
    private BigDecimal precioBase;
    private BigDecimal comision;
    private String subastado;
}
