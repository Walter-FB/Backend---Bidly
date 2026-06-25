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

    @Query("SELECT s FROM Subasta s WHERE EXISTS (" +
           "SELECT 1 FROM SubastaEstadoAdmin sea WHERE sea.subasta = s.identificador " +
           "AND sea.estadoSubasta = 'iniciada')")
    List<Subasta> findAbiertasEfectivas();

    @Query(value = """
            SELECT s.identificador FROM subastas s
            INNER JOIN subasta_estado_admin sea ON sea.subasta = s.identificador
            LEFT JOIN subasta_revision sr ON sr.subasta = s.identificador
            WHERE sea.estado_subasta = 'esperando'
              AND s.fecha IS NOT NULL
              AND (s.fecha + COALESCE(s.hora, TIME '00:00:00')) <= CURRENT_TIMESTAMP
              AND (sr.subasta IS NULL OR sr.estado = 'aprobada')
            """, nativeQuery = true)
    List<Long> findIdsListasParaIniciar();

    List<Subasta> findBySubastador(Long subastadorId);

    @Query("SELECT s FROM Subasta s WHERE EXISTS (" +
           "SELECT 1 FROM SubastaEstadoAdmin sea WHERE sea.subasta = s.identificador " +
           "AND sea.estadoSubasta = 'iniciada') AND " +
           "(:categoria IS NULL OR s.categoria = :categoria) AND " +
           "(:moneda IS NULL OR s.identificador IN " +
           "   (SELECT m.subasta FROM SubastaMoneda m WHERE m.moneda = :moneda))")
    List<Subasta> findIniciadasByFiltros(@Param("categoria") String categoria,
                                         @Param("moneda") String moneda);

    @Query("SELECT s FROM Subasta s WHERE EXISTS (" +
           "SELECT 1 FROM SubastaEstadoAdmin sea WHERE sea.subasta = s.identificador " +
           "AND sea.estadoSubasta = 'finalizada') AND " +
           "(:categoria IS NULL OR s.categoria = :categoria) AND " +
           "(:moneda IS NULL OR s.identificador IN " +
           "   (SELECT m.subasta FROM SubastaMoneda m WHERE m.moneda = :moneda))")
    List<Subasta> findFinalizadasByFiltros(@Param("categoria") String categoria,
                                           @Param("moneda") String moneda);

    @Query("SELECT s FROM Subasta s WHERE " +
           "(:estado IS NULL OR s.estado = :estado) AND " +
           "(:categoria IS NULL OR s.categoria = :categoria) AND " +
           "(:moneda IS NULL OR s.identificador IN " +
           "   (SELECT m.subasta FROM SubastaMoneda m WHERE m.moneda = :moneda))")
    List<Subasta> findByFiltros(@Param("estado") String estado,
                                @Param("categoria") String categoria,
                                @Param("moneda") String moneda);

    @Modifying(clearAutomatically = true)
    @Transactional
    @Query(value = "UPDATE subastas SET estado = :estado WHERE identificador = :id", nativeQuery = true)
    int updateEstadoSiFechaValida(@Param("id") Long id, @Param("estado") String estado);
}
