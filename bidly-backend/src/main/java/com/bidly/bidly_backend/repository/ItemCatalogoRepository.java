package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.ItemCatalogo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface ItemCatalogoRepository extends JpaRepository<ItemCatalogo, Long> {
    List<ItemCatalogo> findByCatalogoIdentificador(Long catalogoId);
    List<ItemCatalogo> findByCatalogoSubastaIdentificador(Long subastaId);

    @Query("SELECT i FROM ItemCatalogo i WHERE i.catalogo.subasta.estado = 'abierta' AND (i.subastado IS NULL OR i.subastado <> 'si')")
    List<ItemCatalogo> findItemsActivosEnSubastasAbiertas();
}
