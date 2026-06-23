package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.ItemCatalogo;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface ItemCatalogoRepository extends JpaRepository<ItemCatalogo, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM ItemCatalogo i WHERE i.identificador = :id")
    Optional<ItemCatalogo> findByIdForUpdate(@Param("id") Long id);

    List<ItemCatalogo> findByCatalogoIdentificador(Long catalogoId);
    @Query("SELECT i FROM ItemCatalogo i JOIN FETCH i.producto JOIN FETCH i.catalogo c WHERE c.subasta.identificador = :subastaId ORDER BY i.identificador")
    List<ItemCatalogo> findBySubastaIdWithDetails(@Param("subastaId") Long subastaId);

    List<ItemCatalogo> findByCatalogoSubastaIdentificador(Long subastaId);

    @Query("SELECT i FROM ItemCatalogo i WHERE i.catalogo.subasta.estado = 'abierta' AND (i.subastado IS NULL OR i.subastado <> 'si')")
    List<ItemCatalogo> findItemsActivosEnSubastasAbiertas();

    boolean existsByProductoIdentificador(Long productoId);
}
