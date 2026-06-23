package com.bidly.bidly_backend.model;

import jakarta.persistence.*;
import lombok.*;

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
}
