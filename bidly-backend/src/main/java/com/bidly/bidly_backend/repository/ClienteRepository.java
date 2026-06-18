package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.Cliente;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClienteRepository extends JpaRepository<Cliente, Long> {
}
