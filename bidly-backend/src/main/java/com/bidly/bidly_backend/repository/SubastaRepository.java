package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.Subasta;
import com.bidly.bidly_backend.model.SubastaMoneda;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

public interface SubastaRepository extends JpaRepository<Subasta, Long> {
    List<Subasta> findByEstado(String estado);

    List<Subasta> findBySubastador(Long subastadorId);

    @Query("SELECT s FROM Subasta s WHERE " +
           "(:estado IS NULL OR s.estado = :estado) AND " +
           "(:categoria IS NULL OR s.categoria = :categoria) AND " +
           "(:moneda IS NULL OR s.identificador IN " +
           "   (SELECT m.subasta FROM SubastaMoneda m WHERE m.moneda = :moneda))")
    List<Subasta> findByFiltros(@Param("estado") String estado,
                                @Param("categoria") String categoria,
                                @Param("moneda") String moneda);

    /** Solo actualiza estado si chkfecha sigue cumpliéndose en la fila. */
    @Modifying(clearAutomatically = true)
    @Transactional
    @Query(value = "UPDATE subastas SET estado = :estado " +
            "WHERE identificador = :id AND fecha > (CURRENT_DATE + INTERVAL '10 days')",
            nativeQuery = true)
    int updateEstadoSiFechaValida(@Param("id") Long id, @Param("estado") String estado);
}
