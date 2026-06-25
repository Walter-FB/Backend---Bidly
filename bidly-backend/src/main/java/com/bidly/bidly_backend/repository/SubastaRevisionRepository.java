package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.SubastaRevision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface SubastaRevisionRepository extends JpaRepository<SubastaRevision, Long> {

    Optional<SubastaRevision> findBySubastaIdentificador(Long subastaId);

    List<SubastaRevision> findByEstadoOrderByFechaSolicitudDesc(String estado);

    List<SubastaRevision> findByEstadoInOrderByFechaSolicitudDesc(Collection<String> estados);

    long countByEstado(String estado);

    @Query("SELECT r FROM SubastaRevision r JOIN FETCH r.subasta WHERE r.estado IN :estados ORDER BY r.fechaSolicitud DESC")
    List<SubastaRevision> findByEstadosWithSubasta(@Param("estados") Collection<String> estados);

    @Query("SELECT r FROM SubastaRevision r JOIN FETCH r.subasta ORDER BY r.fechaSolicitud DESC")
    List<SubastaRevision> findAllWithSubasta();

    List<SubastaRevision> findBySubastaIdentificadorIn(Collection<Long> subastaIds);
}
