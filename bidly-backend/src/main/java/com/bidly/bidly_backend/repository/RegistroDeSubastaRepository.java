package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.RegistroDeSubasta;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RegistroDeSubastaRepository extends JpaRepository<RegistroDeSubasta, Long> {
    List<RegistroDeSubasta> findByClienteIdentificador(Long clienteId);
    List<RegistroDeSubasta> findBySubastaIdentificador(Long subastaId);
}
