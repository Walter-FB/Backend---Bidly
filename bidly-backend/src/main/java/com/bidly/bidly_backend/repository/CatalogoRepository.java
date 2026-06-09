package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.Catalogo;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CatalogoRepository extends JpaRepository<Catalogo, Long> {
    List<Catalogo> findBySubastaIdentificador(Long subastaId);
}
