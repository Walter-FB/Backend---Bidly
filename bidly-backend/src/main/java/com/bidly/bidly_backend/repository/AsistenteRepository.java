package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.Asistente;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AsistenteRepository extends JpaRepository<Asistente, Long> {
    Optional<Asistente> findByClienteIdentificadorAndSubastaIdentificador(Long clienteId, Long subastaId);
}
