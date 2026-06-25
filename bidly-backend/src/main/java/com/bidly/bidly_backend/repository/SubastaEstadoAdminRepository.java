package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.SubastaEstadoAdmin;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface SubastaEstadoAdminRepository extends JpaRepository<SubastaEstadoAdmin, Long> {
    List<SubastaEstadoAdmin> findBySubastaIn(Collection<Long> subastaIds);
}
