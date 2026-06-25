package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.Empleado;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmpleadoRepository extends JpaRepository<Empleado, Long> {
}
