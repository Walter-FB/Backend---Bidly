package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.Puja;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface PujaRepository extends JpaRepository<Puja, Long> {
    Optional<Puja> findTopByItemIdentificadorOrderByImporteDesc(Long itemId);
    Optional<Puja> findByItemIdentificadorAndGanador(Long itemId, String ganador);
    List<Puja> findByItemIdentificadorOrderByImporteDesc(Long itemId);
    List<Puja> findByAsistenteIdentificadorOrderByImporteDesc(Long asistenteId);
}
