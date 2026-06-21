package com.bidly.bidly_backend.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "empleados")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Empleado {

    @Id
    private Long identificador;
    private String cargo;
    private Integer sector;
}
