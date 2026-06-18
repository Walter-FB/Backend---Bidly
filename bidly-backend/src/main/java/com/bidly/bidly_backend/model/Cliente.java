package com.bidly.bidly_backend.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "clientes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Cliente {

    @Id
    private Long identificador;

    @Column(name = "numeropais")
    private Integer numeroPais;
    private String admitido;
    private String categoria;
    private Long verificador;
    @Transient
    private String email;
    @Transient
    private String passwordHash;
}
