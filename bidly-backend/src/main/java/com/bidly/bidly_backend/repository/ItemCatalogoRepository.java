package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.ItemCatalogo;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ItemCatalogoRepository extends JpaRepository<ItemCatalogo, Long> {
    List<ItemCatalogo> findByCatalogoIdentificador(Long catalogoId);
    List<ItemCatalogo> findByCatalogoSubastaIdentificador(Long subastaId);
}
