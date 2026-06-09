package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.MedioPago;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MedioPagoRepository extends JpaRepository<MedioPago, Long> {
    List<MedioPago> findByClienteIdentificador(Long clienteId);
}
