package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.Subasta;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface SubastaRepository extends JpaRepository<Subasta, Long> {
    List<Subasta> findByEstado(String estado);

    List<Subasta> findBySubastador(Long subastadorId);

    @Query("SELECT s FROM Subasta s WHERE " +
           "(:estado IS NULL OR s.estado = :estado) AND " +
           "(:categoria IS NULL OR s.categoria = :categoria) AND " +
           "(:moneda IS NULL OR s.moneda = :moneda)")
    List<Subasta> findByFiltros(@Param("estado") String estado,
                                @Param("categoria") String categoria,
                                @Param("moneda") String moneda);
}
