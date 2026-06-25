package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.PujoFecha;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.Optional;

public interface PujoFechaRepository extends JpaRepository<PujoFecha, Long> {
    @Query(value = "SELECT MAX(pf.fechahora) FROM pujo_fecha pf JOIN pujos p ON pf.pujo = p.identificador WHERE p.item = :itemId", nativeQuery = true)
    Optional<LocalDateTime> findUltimaFechaByItemId(@Param("itemId") Long itemId);

    @Query(value = """
        SELECT MAX(pf.fechahora) FROM pujo_fecha pf
        JOIN pujos p ON pf.pujo = p.identificador
        JOIN itemscatalogo ic ON p.item = ic.identificador
        JOIN catalogos c ON ic.catalogo = c.identificador
        WHERE c.subasta = :subastaId
        """, nativeQuery = true)
    Optional<LocalDateTime> findUltimaFechaBySubastaId(@Param("subastaId") Long subastaId);
}
