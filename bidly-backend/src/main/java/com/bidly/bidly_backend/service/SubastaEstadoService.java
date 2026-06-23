package com.bidly.bidly_backend.service;

import com.bidly.bidly_backend.model.Subasta;
import com.bidly.bidly_backend.model.SubastaEstadoAdmin;
import com.bidly.bidly_backend.repository.SubastaEstadoAdminRepository;
import com.bidly.bidly_backend.repository.SubastaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class SubastaEstadoService {

    @Autowired
    private SubastaRepository subastaRepository;

    @Autowired
    private SubastaEstadoAdminRepository estadoAdminRepository;

    @Transactional
    public void aplicarEstado(Long subastaId, String estado) {
        SubastaEstadoAdmin rec = estadoAdminRepository.findById(subastaId)
                .orElseGet(() -> {
                    SubastaEstadoAdmin n = new SubastaEstadoAdmin();
                    n.setSubasta(subastaId);
                    n.setAlgunaVezAbierta(false);
                    return n;
                });
        rec.setEstado(estado);
        if ("abierta".equals(estado) || "cerrada".equals(estado)) {
            rec.setAlgunaVezAbierta(true);
        }
        estadoAdminRepository.save(rec);
        subastaRepository.updateEstadoSiFechaValida(subastaId, estado);
    }

    public void aplicarOverrides(Collection<Subasta> subastas) {
        if (subastas == null || subastas.isEmpty()) return;
        List<Long> ids = subastas.stream().map(Subasta::getIdentificador).toList();
        Map<Long, SubastaEstadoAdmin> overrides = estadoAdminRepository.findBySubastaIn(ids).stream()
                .collect(Collectors.toMap(SubastaEstadoAdmin::getSubasta, r -> r, (a, b) -> a));
        subastas.forEach(s -> {
            SubastaEstadoAdmin r = overrides.get(s.getIdentificador());
            if (r == null) return;
            if (r.getEstado() != null) s.setEstado(r.getEstado());
            if (Boolean.TRUE.equals(r.getAlgunaVezAbierta())) {
                s.setAlgunaVezAbierta(true);
            }
        });
    }
}
