package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.Producto;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductoRepository extends JpaRepository<Producto, Long> {
}
