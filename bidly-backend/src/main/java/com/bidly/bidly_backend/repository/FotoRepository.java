package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.Foto;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface FotoRepository extends JpaRepository<Foto, Long> {
    List<Foto> findByProductoIdentificador(Long productoId);
}
