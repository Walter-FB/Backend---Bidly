package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.Producto;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductoRepository extends JpaRepository<Producto, Long> {
    List<Producto> findByDuenio(Long duenio);
}
